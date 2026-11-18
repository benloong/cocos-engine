#include "2d/renderer/BitmapFontLayout.h"
#include "rapidjson/document.h"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/writer.h"
#include <fstream>
#include <iostream>
#include <iterator>
struct Glyph { int code; double u,v,w,h,offsetX,offsetY,xAdvance; };
int main(int argc,char **argv) {
 if(argc!=2)return 1;std::ifstream f(argv[1]);std::string json{std::istreambuf_iterator<char>(f),{}};rapidjson::Document d;d.Parse(json.c_str());if(d.HasParseError()||!d.IsArray())return 2;
 rapidjson::StringBuffer b;rapidjson::Writer<rapidjson::StringBuffer>w(b);w.StartArray();
 for(const auto &i:d.GetArray()) {
  cc::BitmapLayoutOptions o;o.width=i["width"].GetDouble();o.height=i["height"].GetDouble();o.fontSize=i["fontSize"].GetDouble();o.sourceFontSize=i["sourceFontSize"].GetDouble();o.lineHeight=i["lineHeight"].GetDouble();o.spacing=i["spacing"].GetDouble();o.overflow=i["overflow"].GetInt();o.horizontal=i["horizontal"].GetInt();o.vertical=i["vertical"].GetInt();o.wrap=i["wrap"].GetBool();
  std::vector<int32_t> text;for(const auto &c:i["text"].GetArray())text.push_back(c.GetInt());std::vector<Glyph> glyphs;std::unordered_map<int32_t,size_t> map;std::unordered_map<uint64_t,float> kern;
  for(const auto &g:i["glyphs"].GetArray()){map[g["code"].GetInt()]=glyphs.size();glyphs.push_back({g["code"].GetInt(),g["u"].GetDouble(),g["v"].GetDouble(),g["w"].GetDouble(),g["h"].GetDouble(),g["offsetX"].GetDouble(),g["offsetY"].GetDouble(),g["xAdvance"].GetDouble()});}
  for(const auto &k:i["kerning"].GetArray())kern[(static_cast<uint64_t>(k[0].GetUint())<<32U)|k[1].GetUint()]=k[2].GetFloat();
  const auto &f=i["frame"];cc::BitmapFrameRect frame{f["x"].GetDouble(),f["y"].GetDouble(),f["width"].GetDouble(),f["height"].GetDouble(),f["originalWidth"].GetDouble(),f["originalHeight"].GetDouble(),f["offsetX"].GetDouble(),f["offsetY"].GetDouble(),f["textureWidth"].GetDouble(),f["textureHeight"].GetDouble(),f["rotated"].GetBool()};
  const auto r=cc::layoutBitmapFont(text,glyphs,map,kern,o);w.StartObject();w.Key("width");w.Double(r.width);w.Key("height");w.Double(r.height);w.Key("actualFontSize");w.Double(r.actualFontSize);w.Key("scale");w.Double(r.scale);w.Key("lineWidths");w.StartArray();for(auto n:r.lineWidths)w.Double(n);w.EndArray();w.Key("glyphs");w.StartArray();
  for(const auto &placement:r.glyphs){const auto quad=cc::buildBitmapGlyphQuad(placement,r.scale,frame);const auto &g=quad.source;w.StartObject();w.Key("x");w.Double(g.x);w.Key("y");w.Double(g.y+r.height);w.Key("u");w.Double(g.u);w.Key("v");w.Double(g.v);w.Key("width");w.Double(g.width);w.Key("height");w.Double(g.height);w.Key("vertices");w.StartArray();for(const auto &v:quad.vertices){w.StartObject();w.Key("x");w.Double(v.x);w.Key("y");w.Double(v.y+r.height);w.Key("u");w.Double(v.u);w.Key("v");w.Double(v.v);w.EndObject();}w.EndArray();w.EndObject();}w.EndArray();w.EndObject();
 }w.EndArray();std::cout<<b.GetString();
}
