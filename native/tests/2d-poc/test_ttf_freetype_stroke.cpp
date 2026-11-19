// Widen the captured DirectWrite contours with FreeType. All coordinates below
// are in glyph space until the final transform into mask pixels.
#include <ft2build.h>
#include FT_FREETYPE_H
#include FT_OUTLINE_H
#include FT_STROKER_H
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {
constexpr double UNITS = 64;
void check(FT_Error error) {
    if (error) throw std::runtime_error("FreeType error " + std::to_string(error));
}
FT_Vector readPoint(std::istream &input) {
    double x{}, y{};
    if (!(input >> x >> y)) throw std::runtime_error("Missing point");
    return {std::lround(x * UNITS), std::lround(y * UNITS)};
}
struct Writer {
    std::ostream &out;
    double a{}, b{}, c{}, d{}, x{}, y{};
    bool started{};
    void point(const FT_Vector *p) {
        out << ' ' << (a * p->x + c * p->y) / UNITS + x << ' ' << (b * p->x + d * p->y) / UNITS + y;
    }
    static int move(const FT_Vector *p, void *context) {
        auto &w = *static_cast<Writer *>(context);
        if (w.started) w.out << "E 1\n";
        w.started = true; w.out << 'M'; w.point(p); w.out << '\n';
        return 0;
    }
    static int line(const FT_Vector *p, void *context) {
        auto &w = *static_cast<Writer *>(context); w.out << 'L'; w.point(p); w.out << '\n'; return 0;
    }
    static int quad(const FT_Vector *p, const FT_Vector *q, void *context) {
        auto &w = *static_cast<Writer *>(context); w.out << 'Q'; w.point(p); w.point(q); w.out << '\n'; return 0;
    }
    static int cubic(const FT_Vector *p, const FT_Vector *q, const FT_Vector *r, void *context) {
        auto &w = *static_cast<Writer *>(context); w.out << 'C'; w.point(p); w.point(q); w.point(r); w.out << '\n'; return 0;
    }
};
void widen(FT_Library library, FT_Stroker stroker, const std::filesystem::path &path, bool bold, FT_StrokerBorder border) {
    std::ifstream input(path);
    auto output = path;
    output.replace_extension(); // N.center
    output.replace_extension(bold ? (border == FT_STROKER_BORDER_LEFT ? ".left.path" : ".right.path") : ".freetype.path");
    std::ofstream out(output);
    out << std::setprecision(12);
    Writer writer{out};
    char op{};
    int width{}, height{}, rule{};
    double thickness{};
    if (!(input >> op >> width >> height) || op != 'S' ||
        !(input >> op >> writer.a >> writer.b >> writer.c >> writer.d >> writer.x >> writer.y >> thickness) || op != 'T' ||
        !(input >> op >> rule) || op != 'F') throw std::runtime_error("Invalid path header");
    out << "S " << width << ' ' << height << "\nF 1\n";
    FT_Stroker_Set(stroker, std::lround(thickness * UNITS / 2), FT_STROKER_LINECAP_ROUND,
                   bold ? FT_STROKER_LINEJOIN_MITER_FIXED : FT_STROKER_LINEJOIN_ROUND, (bold ? 4L : 1L) << 16);
    while (input >> op) {
        if (op == 'E') {
            int closed{};
            if (!(input >> closed) || !closed) throw std::runtime_error("Expected closed glyph contour");
            check(FT_Stroker_EndSubPath(stroker));
            continue;
        }
        auto p = readPoint(input);
        if (op == 'M') check(FT_Stroker_BeginSubPath(stroker, &p, false));
        else if (op == 'L') check(FT_Stroker_LineTo(stroker, &p));
        else if (op == 'C') {
            auto q = readPoint(input);
            auto r = readPoint(input);
            check(FT_Stroker_CubicTo(stroker, &p, &q, &r));
        } else throw std::runtime_error("Unexpected outline command");
    }
    FT_UInt points{}, contours{};
    check(bold ? FT_Stroker_GetBorderCounts(stroker, border, &points, &contours) : FT_Stroker_GetCounts(stroker, &points, &contours));
    FT_Outline outline{};
    check(FT_Outline_New(library, points, contours, &outline));
    outline.n_points = outline.n_contours = 0;
    if (bold) FT_Stroker_ExportBorder(stroker, border, &outline);
    else FT_Stroker_Export(stroker, &outline);
    const FT_Outline_Funcs functions{Writer::move, Writer::line, Writer::quad, Writer::cubic, 0, 0};
    const auto error = FT_Outline_Decompose(&outline, &functions, &writer);
    FT_Outline_Done(library, &outline);
    check(error);
    if (writer.started) out << "E 1\n";
    if (!out) throw std::runtime_error("Failed to write outline");
}
} // namespace

int main(int argc, char **argv) {
    const bool bold = argc == 3 && std::string(argv[2]) == "--bold";
    if (argc != 2 && !bold) return 2;
    FT_Library library{};
    FT_Stroker stroker{};
    int result = 0;
    try {
        check(FT_Init_FreeType(&library));
        check(FT_Stroker_New(library, &stroker));
        for (const auto &entry : std::filesystem::directory_iterator(argv[1])) {
            if (entry.path().stem().extension() != ".center" || entry.path().extension() != ".path") continue;
            widen(library, stroker, entry.path(), bold, FT_STROKER_BORDER_LEFT);
            if (bold) widen(library, stroker, entry.path(), true, FT_STROKER_BORDER_RIGHT);
        }
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n'; result = 1;
    }
    if (stroker) FT_Stroker_Done(stroker);
    if (library) FT_Done_FreeType(library);
    return result;
}
