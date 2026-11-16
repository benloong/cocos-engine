/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#include <cmath>
#include <cstdio>

#include "2d/framework/UITransformMath.h"
#include "2d/renderer/SpriteGeometry.h"

namespace {

int gChecks = 0;
int gFailures = 0;

bool near(float a, float b, float epsilon = 1e-5F) {
    return std::fabs(a - b) <= epsilon;
}

void check(bool condition, const char *message) {
    ++gChecks;
    if (!condition) {
        ++gFailures;
        std::printf("FAIL: %s\n", message);
    }
}

void checkNear(float actual, float expected, const char *message) {
    ++gChecks;
    if (!near(actual, expected)) {
        ++gFailures;
        std::printf("FAIL: %s (expected %f, got %f)\n", message, expected, actual);
    }
}

void checkRect(const cc::Rect &rect, float x, float y, float w, float h, const char *message) {
    check(near(rect.x, x) && near(rect.y, y) && near(rect.width, w) && near(rect.height, h), message);
}

void testSelfBoundingBox() {
    const cc::Rect centered = cc::UITransformMath::getSelfBoundingBox(cc::Vec2(100.F, 80.F), cc::Vec2(0.5F, 0.5F));
    checkRect(centered, -50.F, -40.F, 100.F, 80.F, "self bounding box keeps anchor at origin");

    const cc::Rect bottomLeft = cc::UITransformMath::getSelfBoundingBox(cc::Vec2(100.F, 80.F), cc::Vec2(0.F, 0.F));
    checkRect(bottomLeft, 0.F, 0.F, 100.F, 80.F, "self bounding box with zero anchor starts at origin");
}

void testTransformRect() {
    cc::Mat4 translation;
    cc::Mat4::createTranslation(cc::Vec3(10.F, 20.F, 0.F), &translation);

    const cc::Rect local(-50.F, -50.F, 100.F, 100.F);
    const cc::Rect world = cc::UITransformMath::transformRect(local, translation);
    checkRect(world, -40.F, -30.F, 100.F, 100.F, "transformRect keeps axis aligned size for translation");

    cc::Mat4 scale;
    cc::Mat4::createScale(cc::Vec3(2.F, 3.F, 1.F), &scale);
    const cc::Rect scaled = cc::UITransformMath::transformRect(cc::Rect(0.F, 0.F, 10.F, 10.F), scale);
    checkRect(scaled, 0.F, 0.F, 20.F, 30.F, "transformRect applies scale");
}

void testSpaceConversion() {
    cc::Mat4 world;
    cc::Mat4::createTranslation(cc::Vec3(10.F, 20.F, 0.F), &world);

    const cc::Vec3 worldPoint = cc::UITransformMath::convertToWorldSpaceAR(cc::Vec3(5.F, 6.F, 0.F), world);
    checkNear(worldPoint.x, 15.F, "convertToWorldSpaceAR x");
    checkNear(worldPoint.y, 26.F, "convertToWorldSpaceAR y");

    const cc::Vec3 localPoint = cc::UITransformMath::convertToNodeSpaceAR(cc::Vec3(15.F, 26.F, 0.F), world);
    checkNear(localPoint.x, 5.F, "convertToNodeSpaceAR x");
    checkNear(localPoint.y, 6.F, "convertToNodeSpaceAR y");
}

void testContainsWorldPoint() {
    cc::Mat4 world;
    cc::Mat4::createTranslation(cc::Vec3(10.F, 20.F, 0.F), &world);

    check(cc::UITransformMath::containsWorldPoint(cc::Vec2(10.F, 20.F), cc::Vec2(100.F, 100.F), cc::Vec2(0.5F, 0.5F), world),
          "containsWorldPoint accepts center");
    check(cc::UITransformMath::containsWorldPoint(cc::Vec2(59.F, 69.F), cc::Vec2(100.F, 100.F), cc::Vec2(0.5F, 0.5F), world),
          "containsWorldPoint accepts corner");
    check(!cc::UITransformMath::containsWorldPoint(cc::Vec2(61.F, 20.F), cc::Vec2(100.F, 100.F), cc::Vec2(0.5F, 0.5F), world),
          "containsWorldPoint rejects outside point");
    check(!cc::UITransformMath::containsWorldPoint(cc::Vec2(10.F, 20.F), cc::Vec2(0.F, 100.F), cc::Vec2(0.5F, 0.5F), world),
          "containsWorldPoint rejects zero width");
}

void testSimpleQuadTrimmed() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.trim = true;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    check(quad.valid, "trimmed simple quad is valid");
    checkNear(quad.vertices[0].position.x, -50.F, "trimmed quad left-bottom x");
    checkNear(quad.vertices[0].position.y, -50.F, "trimmed quad left-bottom y");
    checkNear(quad.vertices[1].position.x, 50.F, "trimmed quad right-bottom x");
    checkNear(quad.vertices[2].position.y, 50.F, "trimmed quad left-top y");
    check(quad.indices[0] == 0 && quad.indices[1] == 1 && quad.indices[2] == 2 &&
              quad.indices[3] == 1 && quad.indices[4] == 3 && quad.indices[5] == 2,
          "simple quad index order");
}

void testSimpleQuadUntrimmed() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(50.F, 60.F, 100.F, 100.F);
    params.originalSize = cc::Vec2(200.F, 100.F);
    params.offset = cc::Vec2(0.F, 0.F);
    params.textureSize = cc::Vec2(200.F, 200.F);
    params.trim = false;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    check(quad.valid, "untrimmed simple quad is valid");
    checkNear(quad.vertices[0].position.x, -25.F, "untrimmed quad left-bottom x");
    checkNear(quad.vertices[0].position.y, -50.F, "untrimmed quad left-bottom y");
    checkNear(quad.vertices[1].position.x, 25.F, "untrimmed quad right-bottom x");
    checkNear(quad.vertices[2].position.y, 50.F, "untrimmed quad left-top y");

    checkNear(quad.vertices[0].uv.x, 0.25F, "untrimmed uv left");
    checkNear(quad.vertices[0].uv.y, 0.8F, "untrimmed uv bottom");
    checkNear(quad.vertices[1].uv.x, 0.75F, "untrimmed uv right");
    checkNear(quad.vertices[2].uv.y, 0.3F, "untrimmed uv top");
}

void testSimpleQuadRotatedUV() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(30.F, 40.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(10.F, 20.F, 30.F, 40.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.rotated = true;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    check(quad.valid, "rotated simple quad is valid");
    checkNear(quad.vertices[0].uv.x, 0.1F, "rotated uv left");
    checkNear(quad.vertices[0].uv.y, 0.2F, "rotated uv top");
    checkNear(quad.vertices[1].uv.x, 0.1F, "rotated uv second x");
    checkNear(quad.vertices[1].uv.y, 0.5F, "rotated uv second y");
    checkNear(quad.vertices[2].uv.x, 0.5F, "rotated uv third x");
    checkNear(quad.vertices[2].uv.y, 0.2F, "rotated uv third y");
}

void testTransformQuad() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);

    cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    cc::Mat4 world;
    cc::Mat4::createTranslation(cc::Vec3(10.F, 20.F, 0.F), &world);
    cc::transformSpriteQuad(quad, world);

    checkNear(quad.vertices[0].position.x, -40.F, "world transformed quad x");
    checkNear(quad.vertices[0].position.y, -30.F, "world transformed quad y");
    checkNear(quad.vertices[3].position.x, 60.F, "world transformed quad right");
    checkNear(quad.vertices[3].position.y, 70.F, "world transformed quad top");
}

void testSlicedMesh() {
    cc::SlicedSpriteGeometryParams params;
    params.contentSize = cc::Vec2(200.F, 200.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.insetLeft = 10.F;
    params.insetRight = 10.F;
    params.insetTop = 10.F;
    params.insetBottom = 10.F;

    const cc::SpriteMesh mesh = cc::buildSlicedSpriteMesh(params);
    check(mesh.valid, "sliced mesh is valid");
    check(mesh.vertices.size() == 16, "sliced mesh has 16 vertices");
    check(mesh.indices.size() == 54, "sliced mesh has 54 indices");

    if (mesh.vertices.size() == 16 && mesh.indices.size() == 54) {
        checkNear(mesh.vertices[0].position.x, -100.F, "sliced bottom-left x");
        checkNear(mesh.vertices[0].position.y, -100.F, "sliced bottom-left y");
        checkNear(mesh.vertices[0].uv.x, 0.F, "sliced bottom-left u");
        checkNear(mesh.vertices[0].uv.y, 1.F, "sliced bottom-left v");

        checkNear(mesh.vertices[15].position.x, 100.F, "sliced top-right x");
        checkNear(mesh.vertices[15].position.y, 100.F, "sliced top-right y");
        checkNear(mesh.vertices[15].uv.x, 1.F, "sliced top-right u");
        checkNear(mesh.vertices[15].uv.y, 0.F, "sliced top-right v");

        checkNear(mesh.vertices[5].position.x, -90.F, "sliced first inset x");
        checkNear(mesh.vertices[5].uv.x, 0.1F, "sliced first inset u");
        checkNear(mesh.vertices[10].position.y, 90.F, "sliced top inset y");
        checkNear(mesh.vertices[10].uv.y, 0.1F, "sliced top inset v");
    }
}

void testFilledMesh() {
    cc::FilledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.fillType = 0;
    params.fillStart = 0.25F;
    params.fillRange = 0.5F;

    const cc::SpriteMesh mesh = cc::buildFilledSpriteMesh(params);
    check(mesh.valid, "filled mesh is valid");
    check(mesh.vertices.size() == 4, "filled mesh has 4 vertices");
    check(mesh.indices.size() == 6, "filled mesh has 6 indices");
    if (mesh.vertices.size() == 4) {
        checkNear(mesh.vertices[0].position.x, -25.F, "filled bottom-left x");
        checkNear(mesh.vertices[1].position.x, 25.F, "filled bottom-right x");
        checkNear(mesh.vertices[0].uv.x, 0.25F, "filled left u");
        checkNear(mesh.vertices[1].uv.x, 0.75F, "filled right u");
    }
}

void testNegativeFilledMesh() {
    cc::FilledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100, 100); params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0,0,100,100); params.textureSize = cc::Vec2(100,100);
    params.fillStart = 0.75F; params.fillRange = -0.5F;
    for (int mode = 0; mode < 2; ++mode) {
        params.fillType = mode;
        auto negative = cc::buildFilledSpriteMesh(params);
        params.fillStart = 0.25F; params.fillRange = 0.5F;
        auto positive = cc::buildFilledSpriteMesh(params);
        check(negative.valid && positive.valid, "negative bar fill is valid");
        for (size_t i = 0; i < negative.vertices.size(); ++i) {
            checkNear(negative.vertices[i].position.x, positive.vertices[i].position.x, "negative bar x matches normalized positive interval");
            checkNear(negative.vertices[i].position.y, positive.vertices[i].position.y, "negative bar y matches normalized positive interval");
            checkNear(negative.vertices[i].uv.x, positive.vertices[i].uv.x, "negative bar U");
            checkNear(negative.vertices[i].uv.y, positive.vertices[i].uv.y, "negative bar V");
        }
        params.fillStart = 0.75F; params.fillRange = -0.5F;
    }
}

void testTiledMesh() {
    cc::TiledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(200.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);

    const cc::SpriteMesh mesh = cc::buildTiledSpriteMesh(params);
    check(mesh.valid, "tiled mesh is valid");
    check(mesh.vertices.size() == 8, "tiled mesh has 8 vertices");
    check(mesh.indices.size() == 12, "tiled mesh has 12 indices");
    if (mesh.vertices.size() == 8) {
        checkNear(mesh.vertices[0].position.x, -100.F, "tiled first x");
        checkNear(mesh.vertices[0].position.y, -50.F, "tiled first y");
        checkNear(mesh.vertices[4].position.x, 0.F, "tiled second x");
        checkNear(mesh.vertices[7].position.x, 100.F, "tiled last x");
    }
}

void testRadialMesh() {
    cc::FilledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100,100); params.anchorPoint = cc::Vec2(0.5F,0.5F);
    params.frameRect = cc::Rect(0,0,100,100); params.textureSize = cc::Vec2(100,100);
    params.fillCenter = cc::Vec2(0.5F,0.5F); params.fillType = 2; params.fillRange = 0.5F;
    const auto mesh = cc::buildRadialSpriteMesh(params);
    check(mesh.valid && mesh.vertices.size() == 9 && mesh.indices.size() == 9, "Web radial top half has three edge triangles");
    if (mesh.vertices.size() == 9) {
        checkNear(mesh.vertices[0].position.x, 0, "normalized radial center x");
        checkNear(mesh.vertices[0].uv.x, 0.5F, "radial center u");
        checkNear(mesh.vertices[1].position.x, -50, "radial contains exact rectangle corner x");
        checkNear(mesh.vertices[1].position.y, 50, "radial contains exact rectangle corner y");
        for (const auto &v:mesh.vertices) check(v.position.y >= -1e-5F, "positive radial range covers upper half");
    }
    params.fillRange = -0.5F;
    const auto negative = cc::buildRadialSpriteMesh(params);
    check(negative.valid, "negative radial range remains visible");
    for (const auto &v:negative.vertices) check(v.position.y <= 1e-5F, "negative radial range covers lower half");
}

void testRotatedSlicedMesh() {
    cc::SlicedSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.insetLeft = 10.F;
    params.insetRight = 10.F;
    params.insetTop = 10.F;
    params.insetBottom = 10.F;
    params.rotated = true;

    const cc::SpriteMesh mesh = cc::buildSlicedSpriteMesh(params);
    check(mesh.valid && mesh.vertices.size() == 16, "rotated sliced mesh valid");
    if (mesh.vertices.size() == 16) {
        checkNear(mesh.vertices[0].uv.x, 0.F, "rotated sliced first u");
        checkNear(mesh.vertices[0].uv.y, 0.F, "rotated sliced first v");
        checkNear(mesh.vertices[5].uv.x, 0.1F, "rotated sliced inset u");
        checkNear(mesh.vertices[5].uv.y, 0.1F, "rotated sliced inset v");
        checkNear(mesh.vertices[15].uv.x, 1.F, "rotated sliced last u");
        checkNear(mesh.vertices[15].uv.y, 1.F, "rotated sliced last v");
    }
}

void testRotatedTiledMesh() {
    cc::TiledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(200.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.rotated = true;

    const cc::SpriteMesh mesh = cc::buildTiledSpriteMesh(params);
    check(mesh.valid && mesh.vertices.size() == 8, "rotated tiled mesh valid");
    if (mesh.vertices.size() == 8) {
        checkNear(mesh.vertices[0].uv.x, 0.F, "rotated tiled first u");
        checkNear(mesh.vertices[0].uv.y, 0.F, "rotated tiled first v");
        checkNear(mesh.vertices[7].uv.x, 1.F, "rotated tiled last u");
        checkNear(mesh.vertices[7].uv.y, 1.F, "rotated tiled last v");
    }
}

void testRotatedFilledMesh() {
    cc::FilledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.fillType = 0;
    params.fillStart = 0.F;
    params.fillRange = 0.5F;
    params.rotated = true;

    const cc::SpriteMesh mesh = cc::buildFilledSpriteMesh(params);
    check(mesh.valid && mesh.vertices.size() == 4, "rotated filled mesh valid");
    if (mesh.vertices.size() == 4) {
        checkNear(mesh.vertices[0].uv.x, 0.F, "rotated filled left u");
        checkNear(mesh.vertices[0].uv.y, 0.F, "rotated filled left v");
        checkNear(mesh.vertices[1].uv.x, 0.F, "rotated filled right u");
        checkNear(mesh.vertices[1].uv.y, 0.5F, "rotated filled right v");
        checkNear(mesh.vertices[3].uv.x, 1.F, "rotated filled top u");
        checkNear(mesh.vertices[3].uv.y, 0.5F, "rotated filled top v");
    }
}

void testRotatedRadialMesh() {
    cc::FilledSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.fillType = 2;
    params.fillRange = 0.5F;
    params.rotated = true;
    params.fillCenter = cc::Vec2(0.5F,0.5F);

    const cc::SpriteMesh mesh = cc::buildRadialSpriteMesh(params);
    check(mesh.valid && mesh.vertices.size() == 9, "rotated radial mesh valid");
    if (mesh.vertices.size() == 9) {
        checkNear(mesh.vertices[0].uv.x, 0.5F, "rotated radial center u");
        checkNear(mesh.vertices[0].uv.y, 0.5F, "rotated radial center v");
        checkNear(mesh.vertices[1].uv.x, 1.F, "rotated radial top u");
        checkNear(mesh.vertices[1].uv.y, 0.F, "rotated radial top-left v");
    }
}

void testInvalidUntrimmed() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.trim = false;
    params.originalSize = cc::Vec2(0.F, 0.F);

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    check(!quad.valid, "untrimmed quad with zero original size is invalid");
}

} // namespace

int main() {
    testSelfBoundingBox();
    testTransformRect();
    testSpaceConversion();
    testContainsWorldPoint();
    testSimpleQuadTrimmed();
    testSimpleQuadUntrimmed();
    testSimpleQuadRotatedUV();
    testTransformQuad();
    testSlicedMesh();
    testFilledMesh();
    testNegativeFilledMesh();
    testTiledMesh();
    testRadialMesh();
    testRotatedSlicedMesh();
    testRotatedTiledMesh();
    testRotatedFilledMesh();
    testRotatedRadialMesh();
    testInvalidUntrimmed();

    std::printf("%d checks, %d failures\n", gChecks, gFailures);
    return gFailures == 0 ? 0 : 1;
}
