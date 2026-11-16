#include <cmath>
#include <fstream>
#include <iostream>
#include <iterator>
#include "2d/geometry/GraphicsGeometry.h"
#include "rapidjson/document.h"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/writer.h"

int main(int argc, char **argv) {
    if (argc != 2) return 1;
    std::ifstream file(argv[1], std::ios::binary);
    const std::string text{std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
    rapidjson::Document input;
    input.Parse(text.c_str());
    if (input.HasParseError() || !input.IsArray()) return 2;
    rapidjson::StringBuffer buffer;
    rapidjson::Writer<rapidjson::StringBuffer> out(buffer);
    out.StartArray();
    for (const auto &item : input.GetArray()) {
        cc::GraphicsGeometry g;
        for (const auto &cmd : item["commands"].GetArray()) {
            const std::string op = cmd[0].GetString();
            auto n = [&](int i) { return cmd[i].GetDouble(); };
            if (op == "moveTo")
                g.moveTo(n(1), n(2));
            else if (op == "lineTo")
                g.lineTo(n(1), n(2));
            else if (op == "close")
                g.close();
            else if (op == "clear")
                g.clear();
            else if (op == "rect")
                g.rect(n(1), n(2), n(3), n(4));
            else if (op == "ellipse")
                g.ellipse(n(1), n(2), n(3), n(4));
            else if (op == "circle")
                g.circle(n(1), n(2), n(3));
            else if (op == "roundRect")
                g.roundRect(n(1), n(2), n(3), n(4), n(5));
            else if (op == "arc")
                g.arc(n(1), n(2), n(3), n(4), n(5), cmd[6].GetBool());
            else if (op == "bezierCurveTo")
                g.bezierCurveTo(n(1), n(2), n(3), n(4), n(5), n(6));
            else if (op == "quadraticCurveTo")
                g.quadraticCurveTo(n(1), n(2), n(3), n(4));
            else if (op == "fill")
                g.fill();
            else if (op == "stroke")
                g.stroke();
            else if (op == "lineWidth")
                g.lineWidth = n(1);
            else if (op == "miterLimit")
                g.miterLimit = n(1);
            else if (op == "lineCap")
                g.lineCap = static_cast<cc::GraphicsGeometry::LineCap>(cmd[1].GetInt());
            else if (op == "lineJoin")
                g.lineJoin = static_cast<cc::GraphicsGeometry::LineJoin>(cmd[1].GetInt());
            else if (op == "fillColor" || op == "strokeColor") {
                auto &color = op == "fillColor" ? g.fillColor : g.strokeColor;
                for (int i = 0; i < 4; ++i) color[i] = static_cast<float>(n(i + 1) / 255);
            } else
                return 3;
        }
        out.StartObject();
        out.Key("vertices");
        out.StartArray();
        for (const auto &v : g.getVertices())
            for (float x : v) {
                if (!std::isfinite(x)) return 4;
                out.Double(x == 0 ? 0 : x);
            }
        out.EndArray();
        out.Key("indices");
        out.StartArray();
        for (auto i : g.getIndices()) out.Uint(i);
        out.EndArray();
        out.EndObject();
    }
    // The native mesh keeps 32-bit indices; GPU consumers must split/chunk at
    // their own index format boundary rather than wrap coordinates at 65535.
    cc::GraphicsGeometry large;
    for (int i = 0; i < 20000; ++i) large.rect(i * 2, 0, 1, 1);
    large.fill();
    if (large.getVertices().size() != 80000 || large.getIndices().size() != 120000 || large.getIndices().back() != 79999) return 5;
    out.EndArray();
    std::cout << buffer.GetString();
    return 0;
}
