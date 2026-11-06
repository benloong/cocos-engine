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

#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <memory>
#include <vector>

#include "2d/components/Sprite.h"
#include "2d/framework/UIOpacity.h"
#include "2d/framework/UITransform.h"
#include "2d/renderer/RenderDrawInfo.h"
#include "2d/renderer/RenderEntity.h"
#include "2d/renderer/SpriteGeometry.h"
#include "bindings/jswrapper/SeApi.h"
#include "core/Root.h"
#include "core/assets/Material.h"
#include "core/assets/Texture2D.h"
#include "core/scene-graph/Node.h"
#include "platform/FileUtils.h"
#include "renderer/GFXDeviceManager.h"

#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    #include <windows.h>
    #include <psapi.h>
#endif

// UniversalPlatform references this entry point when the engine library is
// linked into a console program.
int cocos_main(int /*argc*/, const char ** /*argv*/) {
    return 0;
}

bool register_all_native2d(se::Object *globalObject);

namespace {

int gFailures = 0;

void check(bool condition, const char *message) {
    if (!condition) {
        std::printf("FAIL: %s\n", message);
        ++gFailures;
    }
}

void checkNear(float actual, float expected, const char *message) {
    if (std::fabs(actual - expected) > 1e-4F) {
        std::printf("FAIL: %s expected %f got %f\n", message, expected, actual);
        ++gFailures;
    }
}

void testUITransform() {
    cc::Node node("native-2d-poc");
    node.setPosition(10.F, 20.F, 0.F);
    node.updateWorldTransform();

    cc::UITransform transform(&node);
    transform.setContentSize(100.F, 50.F);
    transform.setAnchorPoint(0.5F, 0.5F);

    const cc::Rect box = transform.getBoundingBox();
    checkNear(box.x, -40.F, "bounding box x");
    checkNear(box.y, -5.F, "bounding box y");
    checkNear(box.width, 100.F, "bounding box width");
    checkNear(box.height, 50.F, "bounding box height");

    const cc::Vec2 world = transform.convertToWorldSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(world.x, 10.F, "world space x");
    checkNear(world.y, 20.F, "world space y");

    const cc::Vec2 local = transform.convertToNodeSpaceAR(cc::Vec2(10.F, 20.F));
    checkNear(local.x, 0.F, "node space x");
    checkNear(local.y, 0.F, "node space y");

    check(transform.containsWorldPoint(cc::Vec2(10.F, 20.F)), "contains center");
    check(!transform.containsWorldPoint(cc::Vec2(100.F, 20.F)), "rejects outside");
}

void testSpriteGeometry() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.trim = true;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    check(quad.valid, "simple quad is valid");
    checkNear(quad.vertices[0].position.x, -50.F, "quad left-bottom x");
    checkNear(quad.vertices[0].position.y, -50.F, "quad left-bottom y");
    checkNear(quad.vertices[3].position.x, 50.F, "quad right-top x");
    checkNear(quad.vertices[3].position.y, 50.F, "quad right-top y");
    check(quad.indices[0] == 0 && quad.indices[1] == 1 && quad.indices[2] == 2,
          "quad index order");
}

void testUITransformChildBounds() {
    cc::Node parent("parent");
    cc::UITransform parentTransform(&parent);
    parentTransform.setContentSize(100.F, 100.F);
    parentTransform.setAnchorPoint(0.5F, 0.5F);
    parent.updateWorldTransform();

    auto *child = new cc::Node("child");
    child->setParent(&parent);
    child->setPosition(100.F, 0.F, 0.F);
    child->updateWorldTransform();
    cc::UITransform childTransform(child);
    childTransform.setContentSize(50.F, 50.F);
    childTransform.setAnchorPoint(0.5F, 0.5F);
    child->updateWorldTransform();

    const cc::Rect box = parentTransform.getBoundingBoxToWorld();
    checkNear(box.x, -50.F, "child bbox left");
    checkNear(box.y, -50.F, "child bbox bottom");
    checkNear(box.width, 175.F, "child bbox width");
    checkNear(box.height, 100.F, "child bbox height");
}

void testComponentAttach() {
    cc::Node node("component-attach");
    {
        cc::UITransform transform(&node);
        check(node.getUIComponent() == &transform, "component attached to node");
        check(transform.getNode() == &node, "component node link");
        check(transform.getTypeId() == cc::UITransform::TYPE_ID, "component type id");
    }
    check(node.getUIComponent() == nullptr, "component detached on destroy");

    auto *detached = new cc::UITransform();
    {
        cc::Node other("component-node-destroyed");
        detached->setNode(&other);
        check(other.getUIComponent() == detached, "component attached for node destroy");
    }
    check(detached->getNode() == nullptr, "component cleared on node destroy");
    delete detached;
}

void testUIOpacity() {
    cc::Node node("ui-opacity");
    cc::UITransform transform(&node);
    cc::UIOpacity opacity(&node);

    check(node.getUIComponent(cc::UITransform::TYPE_ID) == &transform, "UITransform in multi slot");
    check(node.getUIComponent(cc::UIOpacity::TYPE_ID) == &opacity, "UIOpacity in multi slot");
    check(node.getUIComponent() != nullptr, "first UI component");

    opacity.setOpacity(128.F);
    checkNear(node._getLocalOpacity(), 128.F / 255.F, "UIOpacity applies to node");

    opacity.setEnabled(false);
    checkNear(node._getLocalOpacity(), 1.F, "UIOpacity disable resets node opacity");

    opacity.setEnabled(true);
    checkNear(node._getLocalOpacity(), 128.F / 255.F, "UIOpacity enable reapplies");
}

void testJsBindings(se::ScriptEngine *scriptEngine) {
    se::Object *globalObject = scriptEngine->getGlobalObject();
    check(globalObject != nullptr, "global object");
    check(register_all_native2d(globalObject), "register_all_native2d");

    const char *script =
        "(function () {"
        "  try {"
        "    if (typeof n2d === 'undefined') return 'n2d undefined';"
        "    var t = new n2d.UITransform();"
        "    t.setContentSizeXY(100, 50);"
        "    t.setAnchorPointXY(0.5, 0.5);"
        "    if (t.getWidth() !== 100) return 'unexpected width';"
        "    if (t.getHeight() !== 50) return 'unexpected height';"
        "    var s = new n2d.Sprite();"
        "    s.setColorRGBA(255, 128, 0, 255);"
        "    s.setTrim(false);"
        "    var o = new n2d.UIOpacity();"
        "    o.setOpacity(128);"
        "    if (o.getOpacity() !== 128) return 'unexpected opacity';"
        "    o.setActive(false);"
        "    o.setActive(true);"
        "    o.detach();"
        "    return 'OK';"
        "  } catch (e) { return String(e); }"
        "})()";
    se::Value result;
    const bool ok = scriptEngine->evalString(script, 0, &result);
    std::printf("jsb bindings result: %s\n", result.isString() ? result.toString().c_str() : "<not string>");
    std::fflush(stdout);
    check(ok && result.isString() && result.toString() == "OK", "jsb n2d.UITransform/Sprite bindings");
}

void testSpritePrepare() {
    cc::Node node("native-sprite");
    cc::UITransform transform(&node);
    transform.setContentSize(100.F, 100.F);

    auto *texture = new cc::Texture2D();
    texture->create(1, 1, cc::Texture2D::PixelFormat::RGBA8888);
    auto *material = new cc::Material();

    cc::Sprite sprite;
    sprite.setNode(&node);
    sprite.setUITransform(&transform);
    sprite.setMaterial(material);
    sprite.setFrame(texture, 0.F, 0.F, 1.F, 1.F, 1.F, 1.F, 0.F, 0.F, 1.F, 1.F, false);

    cc::RenderEntity *entity = sprite.getRenderEntity();
    check(entity != nullptr, "sprite render entity");
    if (entity == nullptr) {
        return;
    }
    // Batcher2d::walk() calls this exact entry point; exercise the callback
    // instead of invoking Sprite::prepare() directly.
    entity->prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 1, "sprite draw info count");
    if (entity->getStaticDrawInfoSize() != 1) {
        return;
    }
    cc::RenderDrawInfo *drawInfo = entity->getStaticRenderDrawInfo(0);
    check(drawInfo != nullptr, "sprite draw info");
    if (drawInfo != nullptr) {
        check(drawInfo->getVbCount() == 4, "sprite vertex count");
        check(drawInfo->getIbCount() == 6, "sprite index count");
        check(drawInfo->getMaterial() == material, "sprite material");
        check(drawInfo->getTexture() == texture->getGFXTexture(), "sprite texture");
    }

    constexpr int kPrepareIterations = 10000;
    const auto start = std::chrono::steady_clock::now();
    for (int i = 0; i < kPrepareIterations; ++i) {
        sprite.setDirty();
        entity->prepare(1.F);
    }
    const auto elapsed = std::chrono::steady_clock::now() - start;
    const auto nanos = std::chrono::duration_cast<std::chrono::nanoseconds>(elapsed).count();
    std::printf("native sprite prepare: %.1f ns/op\n",
                static_cast<double>(nanos) / static_cast<double>(kPrepareIterations));
}

size_t getWorkingSetBytes() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    PROCESS_MEMORY_COUNTERS counters{};
    if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) {
        return static_cast<size_t>(counters.WorkingSetSize);
    }
#endif
    return 0;
}

void writeSpriteQuadJson() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.originalSize = cc::Vec2(100.F, 100.F);
    params.trim = false;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    std::ofstream out("native-sprite-quad.json");
    if (!out) {
        return;
    }
    out << "{\n  \"stride\": 9,\n  \"vertices\": [\n";
    for (int i = 0; i < 4; ++i) {
        out << "    [" << quad.vertices[i].position.x << ", " << quad.vertices[i].position.y
            << ", 0, " << quad.vertices[i].uv.x << ", " << quad.vertices[i].uv.y
            << ", 255, 255, 255, 255]";
        out << (i == 3 ? "\n" : ",\n");
    }
    out << "  ],\n  \"indices\": [";
    for (int i = 0; i < 6; ++i) {
        out << static_cast<int>(quad.indices[i]) << (i == 5 ? "" : ", ");
    }
    out << "]\n}\n";
}

void testSpriteSceneBenchmark() {
    constexpr int kSpriteCount = 1000;
    const size_t memoryBefore = getWorkingSetBytes();
    std::vector<std::unique_ptr<cc::Node>> nodes;
    std::vector<std::unique_ptr<cc::UITransform>> transforms;
    std::vector<std::unique_ptr<cc::Sprite>> sprites;
    nodes.reserve(kSpriteCount);
    transforms.reserve(kSpriteCount);
    sprites.reserve(kSpriteCount);

    auto *texture = new cc::Texture2D();
    texture->create(1, 1, cc::Texture2D::PixelFormat::RGBA8888);
    auto *material = new cc::Material();

    for (int i = 0; i < kSpriteCount; ++i) {
        auto node = std::make_unique<cc::Node>("sprite");
        node->setPosition(static_cast<float>(i % 40) * 10.F, static_cast<float>(i / 40) * 10.F, 0.F);
        node->updateWorldTransform();
        auto transform = std::make_unique<cc::UITransform>(node.get());
        transform->setContentSize(32.F, 32.F);
        auto sprite = std::make_unique<cc::Sprite>();
        sprite->setNode(node.get());
        sprite->setUITransform(transform.get());
        sprite->setMaterial(material);
        sprite->setFrame(texture, 0.F, 0.F, 1.F, 1.F, 1.F, 1.F, 0.F, 0.F, 1.F, 1.F, false);

        nodes.emplace_back(std::move(node));
        transforms.emplace_back(std::move(transform));
        sprites.emplace_back(std::move(sprite));
    }

    const auto start = std::chrono::steady_clock::now();
    for (auto &sprite : sprites) {
        sprite->setDirty();
        sprite->getRenderEntity()->prepare(1.F);
    }
    const auto elapsed = std::chrono::steady_clock::now() - start;
    const auto nanos = std::chrono::duration_cast<std::chrono::nanoseconds>(elapsed).count();
    std::printf("native sprite scene: %d sprites, %.1f us total, %.1f ns/sprite\n",
                kSpriteCount,
                static_cast<double>(nanos) / 1000.0,
                static_cast<double>(nanos) / static_cast<double>(kSpriteCount));

    const size_t memoryAfter = getWorkingSetBytes();
    if (memoryBefore != 0 && memoryAfter > memoryBefore) {
        std::printf("native heap delta: %.1f KB total, %.0f bytes/sprite\n",
                    static_cast<double>(memoryAfter - memoryBefore) / 1024.0,
                    static_cast<double>(memoryAfter - memoryBefore) / static_cast<double>(kSpriteCount));
    }
}

} // namespace

int main() {
    // Node's shared-memory bridge needs a running script engine; Root/Device
    // are required by the surrounding engine singletons.
    cc::Root *root = new cc::Root(cc::gfx::DeviceManager::create());
    auto *scriptEngine = new se::ScriptEngine();
    cc::FileUtils::getInstance();
    scriptEngine->start();
    {
        se::AutoHandleScope scope;
        testUITransform();
        testUITransformChildBounds();
        testComponentAttach();
        testUIOpacity();
        std::printf("uitransform done\n");
        std::fflush(stdout);
        testJsBindings(scriptEngine);
        std::printf("jsb bindings done\n");
        std::fflush(stdout);
        testSpriteGeometry();
        writeSpriteQuadJson();
        std::printf("geometry done\n");
        std::fflush(stdout);
        testSpritePrepare();
        std::printf("sprite prepare done\n");
        std::fflush(stdout);
        testSpriteSceneBenchmark();
        std::printf("sprite scene benchmark done\n");
        std::fflush(stdout);
    }
    scriptEngine->cleanup();
    delete scriptEngine;
    delete root;

    std::printf("native 2D PoC: %s\n", gFailures == 0 ? "PASS" : "FAIL");
    return gFailures == 0 ? 0 : 1;
}
