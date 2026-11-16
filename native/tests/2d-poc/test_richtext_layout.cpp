#include "2d/renderer/RichTextLayout.h"
#include "rapidjson/document.h"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/writer.h"
#include <cmath>
#include <fstream>
#include <iostream>
#include <iterator>

int main(int argc, char **argv) {
    if (argc != 2) return 1;
    std::ifstream file(argv[1], std::ios::binary);
    const std::string json{std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
    rapidjson::Document input; input.Parse(json.c_str());
    if (input.HasParseError() || !input.IsArray()) return 2;
    rapidjson::StringBuffer buffer; rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
    auto number = [&](double value) { if (std::isfinite(value)) writer.Double(value == 0 ? 0 : value); else writer.Null(); };
    writer.StartArray();
    for (const auto &item : input.GetArray()) {
        const auto spans = cc::RichTextParser::parse(item["html"].GetString());
        cc::RichTextLayoutOptions options;
        options.fontSize = item["fontSize"].GetDouble(); options.lineHeight = item["lineHeight"].GetDouble();
        options.maxWidth = item["maxWidth"].GetDouble(); options.horizontalAlign = item["align"].GetInt();
        options.anchorX = item["anchorX"].GetDouble(); options.anchorY = item["anchorY"].GetDouble();
        const auto result = cc::RichTextLayout::build(spans, options, [&](size_t index, const std::string &text) {
            const auto &style = spans[index].style;
            double size = style && style->size && *style->size != 0 && std::isfinite(*style->size) ? *style->size : options.fontSize;
            size_t units = 0;
            for (unsigned char ch : text) { if ((ch & 0xC0) != 0x80) units += ch >= 0xF0 ? 2 : 1; }
            const double outline = style && style->outline ? style->outline->width : 0;
            const double weight = style && style->bold ? 1.1 : 1;
            return cc::RichTextExtent{units * size * 0.5 * weight + (units ? 2 * outline : 0), size * 1.26 + 2 * outline};
        }, [&](const std::string &name) -> std::optional<cc::RichTextExtent> {
            if (name == "icon") return cc::RichTextExtent{24, 12};
            if (name == "wide") return cc::RichTextExtent{200, 30};
            return std::nullopt;
        });
        writer.StartObject();
        writer.Key("width"); number(result.width); writer.Key("height"); number(result.height);
        writer.Key("lineCount"); writer.Uint(result.lineCount);
        writer.Key("linesWidth"); writer.StartArray(); for (auto value : result.linesWidth) number(value); writer.EndArray();
        writer.Key("placements"); writer.StartArray();
        for (const auto &placement : result.placements) {
            writer.StartObject();
            writer.Key("spanIndex"); writer.Uint(static_cast<unsigned>(placement.spanIndex));
            writer.Key("text"); writer.String(placement.text.c_str());
            writer.Key("image"); writer.Bool(placement.image); writer.Key("line"); writer.Uint(placement.line);
            writer.Key("x"); number(placement.x); writer.Key("y"); number(placement.y);
            writer.Key("width"); number(placement.width); writer.Key("height"); number(placement.height);
            writer.Key("anchorY"); number(placement.anchorY);
            writer.EndObject();
        }
        writer.EndArray(); writer.EndObject();
    }
    writer.EndArray(); std::cout << buffer.GetString();
}
