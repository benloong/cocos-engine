#include <cstdio>
#include "2d/renderer/SpriteGeometry.h"
int main() {
    const cc::Vec2 centers[]={{0,0},{0,0.5F},{1,1},{0.5F,0.5F},{0.25F,0.75F},{-0.25F,1.25F},{1,0.5F},{0.5F,0},{0.5F,1}};
    const float starts[]={0,0.125F,0.25F,0.5F,0.75F,1,0.17F};
    const float ranges[]={0,0.125F,0.5F,1,-0.125F,-0.5F,-1,0.61F};
    bool comma=false; std::printf("[");
    for (int layout=0;layout<3;++layout) for (auto center:centers) for (auto start:starts) for (auto range:ranges) for (int rotated=0;rotated<2;++rotated) {
        cc::FilledSpriteGeometryParams p;
        p.contentSize=layout==1?cc::Vec2(177,63):cc::Vec2(100,100);
        p.anchorPoint=layout==0?cc::Vec2(0.5F,0.5F):(layout==1?cc::Vec2(0,0):cc::Vec2(0.25F,0.75F));
        p.frameRect=cc::Rect(7,11,40,28);p.textureSize=cc::Vec2(128,256);
        p.fillCenter=center;p.fillStart=start;p.fillRange=range;p.rotated=rotated!=0;p.fillType=2;
        auto mesh=cc::buildRadialSpriteMesh(p);
        std::printf("%s{\"width\":%.9g,\"height\":%.9g,\"anchor\":[%.9g,%.9g],\"center\":[%.9g,%.9g],\"start\":%.9g,\"range\":%.9g,\"rotated\":%s,\"vertices\":[",
            comma?",":"",double(p.contentSize.x),double(p.contentSize.y),double(p.anchorPoint.x),double(p.anchorPoint.y),double(center.x),double(center.y),double(start),double(range),rotated?"true":"false");
        comma=true;
        for (size_t i=0;i<mesh.vertices.size();++i){const auto &v=mesh.vertices[i];std::printf("%s[%.9g,%.9g,%.9g,%.9g]",i?",":"",double(v.position.x),double(v.position.y),double(v.uv.x),double(v.uv.y));}
        std::printf("],\"indices\":[");
        for(size_t i=0;i<mesh.indices.size();++i)std::printf("%s%u",i?",":"",unsigned(mesh.indices[i]));
        std::printf("]}");
    }
    std::printf("]");
}
