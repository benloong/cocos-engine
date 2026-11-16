// Standalone native parser output consumed by the actual Web parser parity test.
#include "2d/renderer/RichTextParser.h"
#include "rapidjson/document.h"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/writer.h"
#include <cmath>
#include <fstream>
#include <iostream>
#include <iterator>

using Writer = rapidjson::Writer<rapidjson::StringBuffer>;
void string(Writer &writer, const std::string &value) {
    writer.String(value.data(), static_cast<rapidjson::SizeType>(value.size()));
}
void property(Writer &writer, const char *key, const std::optional<std::string> &value) {
    if (value) { writer.Key(key); string(writer, *value); }
}
void property(Writer &writer, const char *key, const std::optional<double> &value) {
    if (value) { writer.Key(key); if (std::isfinite(*value)) writer.Double(*value == 0 ? 0 : *value); else writer.Null(); }
}
void flag(Writer &writer, const char *key, bool value) {
    if (value) { writer.Key(key); writer.Bool(true); }
}
void style(Writer &writer, const cc::RichTextStyle &value) {
    writer.StartObject();
    property(writer, "color", value.color); property(writer, "size", value.size);
    flag(writer, "isNewLine", value.isNewLine); flag(writer, "isImage", value.isImage);
    flag(writer, "underline", value.underline); flag(writer, "bold", value.bold); flag(writer, "italic", value.italic);
    property(writer, "src", value.src); property(writer, "imageWidth", value.imageWidth); property(writer, "imageHeight", value.imageHeight);
    property(writer, "imageOffset", value.imageOffset); property(writer, "imageAlign", value.imageAlign);
    if (value.event) {
        writer.Key("event"); writer.StartObject();
        for (const auto &entry : *value.event) { string(writer, entry.first); string(writer, entry.second); }
        writer.EndObject();
    }
    if (value.outline) {
        writer.Key("outline"); writer.StartObject();
        writer.Key("color"); string(writer, value.outline->color);
        property(writer, "width", std::make_optional(value.outline->width));
        writer.EndObject();
    }
    writer.EndObject();
}
int main(int argc, char **argv) {
    if (argc != 2) { std::cerr << "expected parser input JSON path\n"; return 1; }
    std::ifstream input(argv[1], std::ios::binary);
    const std::string json{std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
    rapidjson::Document document;
    document.Parse(json.c_str());
    if (document.HasParseError() || !document.IsArray()) { std::cerr << "invalid parser fixture\n"; return 2; }
    rapidjson::StringBuffer buffer;
    Writer writer(buffer); writer.StartArray();
    for (const auto &item : document.GetArray()) {
        if (!item.IsString()) return 3;
        const auto spans = cc::RichTextParser::parse(std::string(item.GetString(), item.GetStringLength()));
        writer.StartArray();
        for (const auto &span : spans) {
            writer.StartObject(); writer.Key("text"); string(writer, span.text);
            if (span.style) { writer.Key("style"); style(writer, *span.style); }
            writer.EndObject();
        }
        writer.EndArray();
    }
    writer.EndArray(); std::cout << buffer.GetString();
}
