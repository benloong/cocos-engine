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
#include "2d/assets/SpriteFrame.h"
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
#include "math/Mat4.h"
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
bool register_all_engine(se::Object *globalObject);
bool register_all_scene(se::Object *globalObject);

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

void checkClose(float actual, float expected, float epsilon, const char *message) {
    if (std::fabs(actual - expected) > epsilon) {
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

void testUITransformParity() {
    cc::Node node("parity");
    node.updateWorldTransform();
    cc::UITransform transform(&node);
    transform.setContentSize(180.F, 180.F);

    cc::Rect box = transform.getBoundingBox();
    checkNear(box.x, -90.F, "parity bbox x");
    checkNear(box.y, -90.F, "parity bbox y");
    checkNear(box.width, 180.F, "parity bbox width");
    checkNear(box.height, 180.F, "parity bbox height");

    transform.setAnchorPoint(0.1F, 0.6F);
    box = transform.getBoundingBox();
    checkNear(box.x, -18.F, "parity anchor bbox x");
    checkNear(box.y, -108.F, "parity anchor bbox y");

    node.setPosition(100.5F, -10.5F, 0.F);
    node.updateWorldTransform();
    box = transform.getBoundingBox();
    checkNear(box.x, 82.5F, "parity position bbox x");
    checkNear(box.y, -118.5F, "parity position bbox y");

    node.setRotationFromEuler(0.F, 0.F, 45.F);
    node.updateWorldTransform();
    box = transform.getBoundingBox();
    checkClose(box.x, 36.86F, 0.05F, "parity rotated bbox x");
    checkClose(box.y, -99.6F, 0.05F, "parity rotated bbox y");
    checkClose(box.width, 254.56F, 0.05F, "parity rotated bbox width");
    checkClose(box.height, 254.56F, 0.05F, "parity rotated bbox height");

    cc::Node convertNode("convert");
    convertNode.setPosition(50.F, 50.F, 0.F);
    convertNode.updateWorldTransform();
    cc::UITransform convertTransform(&convertNode);
    convertTransform.setContentSize(180.F, 180.F);
    const cc::Vec2 local = convertTransform.convertToNodeSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(local.x, -50.F, "parity convert local x");
    checkNear(local.y, -50.F, "parity convert local y");
    const cc::Vec2 world = convertTransform.convertToWorldSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(world.x, 50.F, "parity convert world x");
    checkNear(world.y, 50.F, "parity convert world y");
}

void testUITransformScaleParity() {
    cc::Node scaled("scaled");
    scaled.setScale(2.F, 2.F, 1.F);
    scaled.updateWorldTransform();
    cc::UITransform scaledTransform(&scaled);
    scaledTransform.setContentSize(100.F, 100.F);
    const cc::Rect box = scaledTransform.getBoundingBox();
    checkNear(box.x, -100.F, "scaled bbox x");
    checkNear(box.y, -100.F, "scaled bbox y");
    checkNear(box.width, 200.F, "scaled bbox width");
    checkNear(box.height, 200.F, "scaled bbox height");

    cc::Node parent("scaled-parent");
    parent.setPosition(10.F, 10.F, 0.F);
    parent.setScale(2.F, 2.F, 1.F);
    parent.updateWorldTransform();
    auto *child = new cc::Node("scaled-child");
    child->setParent(&parent);
    child->setPosition(10.F, 0.F, 0.F);
    child->updateWorldTransform();
    cc::UITransform childTransform(child);
    childTransform.setContentSize(20.F, 20.F);
    const cc::Vec2 world = childTransform.convertToWorldSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(world.x, 30.F, "scaled nested world x");
    checkNear(world.y, 10.F, "scaled nested world y");
    const cc::Rect childBox = childTransform.getBoundingBoxToWorld();
    checkNear(childBox.x, 10.F, "scaled nested bbox x");
    checkNear(childBox.y, -10.F, "scaled nested bbox y");
    checkNear(childBox.width, 40.F, "scaled nested bbox width");
    checkNear(childBox.height, 40.F, "scaled nested bbox height");

    cc::Node rotatedScaled("rotated-scaled");
    rotatedScaled.setScale(2.F, 2.F, 1.F);
    rotatedScaled.setRotationFromEuler(0.F, 0.F, 45.F);
    rotatedScaled.updateWorldTransform();
    cc::UITransform rotatedScaledTransform(&rotatedScaled);
    rotatedScaledTransform.setContentSize(100.F, 100.F);
    const cc::Rect rotatedBox = rotatedScaledTransform.getBoundingBox();
    checkClose(rotatedBox.width, 282.84F, 0.1F, "scaled rotated bbox width");
    checkClose(rotatedBox.height, 282.84F, 0.1F, "scaled rotated bbox height");
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

    cc::Mat4 target;
    cc::Mat4::createTranslation(-100.F, 0.F, 0.F, &target);
    const cc::Rect localBox = parentTransform.getBoundingBoxTo(target);
    checkNear(localBox.x, 50.F, "target-space bbox left");
    checkNear(localBox.y, -50.F, "target-space bbox bottom");
    checkNear(localBox.width, 175.F, "target-space bbox width");
    checkNear(localBox.height, 100.F, "target-space bbox height");
}

void testUITransformRotatedParity() {
    cc::Node parent("parent");
    parent.setPosition(50.F, 50.F, 0.F);

    auto *node = new cc::Node("node");
    node->setParent(&parent);
    cc::UITransform transform(node);
    transform.setContentSize(180.F, 180.F);
    transform.setAnchorPoint(0.1F, 0.6F);

    auto *child = new cc::Node("child");
    child->setParent(node);
    child->setPosition(50.F, 58.F, 0.F);
    cc::UITransform childTransform(child);
    childTransform.setContentSize(300.F, 150.F);

    parent.updateWorldTransform();
    node->updateWorldTransform();
    child->updateWorldTransform();

    cc::Rect box = transform.getBoundingBoxToWorld();
    checkNear(box.x, -50.F, "world child bbox x");
    checkNear(box.y, -58.F, "world child bbox y");
    checkNear(box.width, 300.F, "world child bbox width");
    checkNear(box.height, 241.F, "world child bbox height");

    parent.setRotationFromEuler(0.F, 0.F, 45.F);
    parent.updateWorldTransform();
    node->updateWorldTransform();
    child->updateWorldTransform();
    box = transform.getBoundingBoxToWorld();
    checkClose(box.x, -114.76F, 0.05F, "rotated world bbox x");
    checkClose(box.y, -39.1F, 0.05F, "rotated world bbox y");
    checkClose(box.width, 355.67F, 0.05F, "rotated world bbox width");
    checkClose(box.height, 324.56F, 0.05F, "rotated world bbox height");

    cc::Node targetNode("target");
    targetNode.setPosition(100.5F, -10.5F, 0.F);
    targetNode.setRotationFromEuler(0.F, 0.F, 60.F);
    targetNode.updateWorldTransform();

    cc::Node source("source");
    cc::UITransform sourceTransform(&source);
    sourceTransform.setContentSize(100.F, 100.F);
    const cc::Rect targetBox = sourceTransform.getBoundingBoxTo(targetNode.getWorldMatrix());
    checkClose(targetBox.x, -109.46F, 0.05F, "rotated target bbox x");
    checkClose(targetBox.y, 23.98F, 0.05F, "rotated target bbox y");
    checkClose(targetBox.width, 136.6F, 0.05F, "rotated target bbox width");
    checkClose(targetBox.height, 136.6F, 0.05F, "rotated target bbox height");
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
    check(register_all_engine(globalObject), "register_all_engine");
    check(register_all_scene(globalObject), "register_all_scene");
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
        "    if (t.getBoundingBoxX() !== -50 || t.getBoundingBoxY() !== -25) return 'unexpected bbox origin';"
        "    if (t.getBoundingBoxWidth() !== 100 || t.getBoundingBoxHeight() !== 50) return 'unexpected bbox size';"
        "    if (t.convertToWorldSpaceARX(3, 4) !== 3 || t.convertToWorldSpaceARY(3, 4) !== 4) return 'unexpected world conversion';"
        "    if (t.containsWorldPointXY(0, 0)) return 'unexpected hit';"
        "    if (t.hitTestXY(0, 0)) return 'unexpected screen hit';"
        "    var identity = new jsb.Mat4();"
        "    if (t.getBoundingBoxToX(identity) !== -50) return 'unexpected target bbox x';"
        "    if (t.getBoundingBoxToWidth(identity) !== 100) return 'unexpected target bbox width';"
        "    t.detach();"
        "    var ur = new n2d.UIRenderer();"
        "    ur.setColorRGBA(1, 2, 3, 255);"
        "    ur.setPriority(5);"
        "    var sf = new n2d.SpriteFrame();"
        "    sf.setRect(0, 0, 1, 1);"
        "    sf.setOriginalSize(1, 1);"
        "    sf.setOffset(0, 0);"
        "    sf.setRotated(false);"
        "    sf.setInsets(1, 2, 3, 4);"
        "    var s = new n2d.Sprite();"
        "    s.setColorRGBA(255, 128, 0, 255);"
        "    s.setTrim(false);"
        "    var o = new n2d.UIOpacity();"
        "    o.setOpacity(128);"
        "    if (o.getOpacity() !== 128) return 'unexpected opacity';"
        "    o.setActive(false);"
        "    o.setActive(true);"
        "    o.detach();"
        "    var node = new jsb.Node('jsb-node');"
        "    var attached = new n2d.UITransform(node);"
        "    if (attached.getWidth() !== 100) return 'unexpected attached width';"
        "    attached.detach();"
        "    var scene = new jsb.Scene('jsb-scene');"
        "    var sceneNode = new jsb.Node('scene-node');"
        "    scene.addChild(sceneNode);"
        "    sceneNode.setPositionJS(10, 20, 0);"
        "    var sceneTransform = new n2d.UITransform(sceneNode);"
        "    sceneTransform.setContentSizeXY(100, 50);"
        "    if (sceneTransform.getBoundingBoxWidth() !== 100) return 'unexpected scene width';"
        "    if (sceneTransform.getBoundingBoxX() !== -40) return 'unexpected scene position';"
        "    var sceneOpacity = new n2d.UIOpacity(sceneNode);"
        "    sceneOpacity.setOpacity(128);"
        "    sceneOpacity.detach();"
        "    sceneTransform.detach();"
        "    return 'OK';"
        "  } catch (e) { return String(e); }"
        "})()";
    se::Value result;
    const bool ok = scriptEngine->evalString(script, 0, &result);
    std::printf("jsb bindings result: %s\n", result.isString() ? result.toString().c_str() : "<not string>");
    std::fflush(stdout);
    check(ok && result.isString() && result.toString() == "OK", "jsb n2d.UITransform/Sprite bindings");
}

void testJsSceneRecord(se::ScriptEngine *scriptEngine) {
    const char *record = R"JSON({
        "name": "root",
        "position": [10, 20],
        "size": [100, 50],
        "anchor": [0.5, 0.5],
        "opacity": 128,
        "children": [
            {
                "name": "child",
                "position": [100, 0],
                "size": [50, 50],
                "anchor": [0.5, 0.5],
                "opacity": 64,
                "opacityFirst": true,
                "children": [
                    { "name": "grandchild", "position": [50, 0], "size": [20, 20], "anchor": [0.5, 0.5] }
                ]
            }
        ]
    })JSON";

    std::string script = R"JS(
(function () {
    var record = )JS";
    script += record;
    script += R"JS(;
    function load(record, parent) {
        var node = new jsb.Node(record.name);
        parent.addChild(node);
        if (record.position) node.setPositionJS(record.position[0], record.position[1], 0);
        var transform = null;
        var opacity = null;
        function createOpacity() {
            if (record.opacity !== undefined && opacity === null) {
                opacity = new n2d.UIOpacity(node);
                opacity.setOpacity(record.opacity);
            }
        }
        if (record.opacityFirst) createOpacity();
        if (record.size) {
            transform = new n2d.UITransform(node);
            transform.setContentSizeXY(record.size[0], record.size[1]);
            if (record.anchor) transform.setAnchorPointXY(record.anchor[0], record.anchor[1]);
        }
        createOpacity();
        var children = [];
        (record.children || []).forEach(function (child) {
            children.push(load(child, node));
        });
        return { node: node, transform: transform, opacity: opacity, children: children };
    }
    var scene = new jsb.Scene('scene-record');
    var root = load(record, scene);
    if (!root.transform) return 'missing root transform';
    if (root.transform.getBoundingBoxToWorldX() !== -40) return 'unexpected record bbox x';
    if (root.transform.getBoundingBoxToWorldWidth() !== 175) return 'unexpected record bbox width';
    if (root.transform.getBoundingBoxToWorldHeight() !== 50) return 'unexpected record bbox height';
    if (!root.opacity || root.opacity.getOpacity() !== 128) return 'unexpected record opacity';
    if (!root.children[0].transform || root.children[0].transform.getBoundingBoxWidth() !== 50) return 'unexpected child width';
    if (!root.children[0].opacity || root.children[0].opacity.getOpacity() !== 64) return 'unexpected child opacity';
    if (!root.children[0].children[0].transform || root.children[0].children[0].transform.getBoundingBoxWidth() !== 20) return 'unexpected grandchild width';

    var cloneRecord = JSON.parse(JSON.stringify(record));
    cloneRecord.name = 'clone';
    cloneRecord.position = [-10, 0];
    cloneRecord.size = [40, 40];
    cloneRecord.opacity = 32;
    cloneRecord.children = [];
    var cloneRoot = load(cloneRecord, scene);
    if (cloneRoot.transform.getBoundingBoxToWorldX() !== -30) return 'unexpected clone bbox x';
    if (cloneRoot.transform.getBoundingBoxToWorldWidth() !== 40) return 'unexpected clone bbox width';
    if (cloneRoot.opacity.getOpacity() !== 32) return 'unexpected clone opacity';
    if (root.transform.getBoundingBoxToWorldWidth() !== 175) return 'original changed after clone';
    if (root.opacity.getOpacity() !== 128) return 'original opacity changed after clone';
    return 'OK';
})()
)JS";

    se::Value result;
    const bool ok = scriptEngine->evalString(script.c_str(), static_cast<uint32_t>(script.size()), &result);
    std::printf("jsb scene record: %s\n", result.isString() ? result.toString().c_str() : "<not string>");
    std::fflush(stdout);
    check(ok && result.isString() && result.toString() == "OK", "jsb scene record attach");
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
    check(sprite.getRenderMaterial() == material, "ui renderer material");
    auto *material2 = new cc::Material();
    sprite.setSharedMaterial(material2, 1);
    check(sprite.getSharedMaterial(1) == material2, "ui renderer shared material");
    check(sprite.getSharedMaterial(0) == material, "ui renderer shared material zero");
    check(sprite.getTypeId() == cc::Sprite::TYPE_ID, "sprite type id");
    sprite.setColorRGBA(10.F, 20.F, 30.F, 255.F);
    check(sprite.getColor().r == 10 && sprite.getColor().g == 20 && sprite.getColor().b == 30, "ui renderer color");
    sprite.setPriority(7);
    check(sprite.getPriority() == 7, "ui renderer priority");
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

    cc::Node slicedNode("native-sprite-sliced");
    cc::UITransform slicedTransform(&slicedNode);
    slicedTransform.setContentSize(200.F, 200.F);
    cc::Sprite slicedSprite;
    slicedSprite.setNode(&slicedNode);
    slicedSprite.setUITransform(&slicedTransform);
    slicedSprite.setMaterial(material);
    slicedSprite.setType(1);
    cc::SpriteFrame slicedFrame;
    slicedFrame.setTexture(texture);
    slicedFrame.setRect(0.F, 0.F, 1.F, 1.F);
    slicedFrame.setOriginalSize(1.F, 1.F);
    slicedFrame.setInsets(0.F, 0.F, 0.F, 0.F);
    slicedSprite.setFrame(&slicedFrame);
    cc::RenderEntity *slicedEntity = slicedSprite.getRenderEntity();
    check(slicedEntity != nullptr, "sliced sprite render entity");
    if (slicedEntity != nullptr) {
        slicedEntity->prepare(1.F);
        cc::RenderDrawInfo *slicedDrawInfo = slicedEntity->getStaticRenderDrawInfo(0);
        check(slicedDrawInfo != nullptr, "sliced sprite draw info");
        if (slicedDrawInfo != nullptr) {
            check(slicedDrawInfo->getVbCount() == 16, "sliced sprite vertex count");
            check(slicedDrawInfo->getIbCount() == 54, "sliced sprite index count");
        }
    }

    cc::Node filledNode("native-sprite-filled");
    cc::UITransform filledTransform(&filledNode);
    filledTransform.setContentSize(100.F, 100.F);
    cc::Sprite filledSprite;
    filledSprite.setNode(&filledNode);
    filledSprite.setUITransform(&filledTransform);
    filledSprite.setMaterial(material);
    filledSprite.setType(3);
    filledSprite.setFillType(0);
    filledSprite.setFillStart(0.25F);
    filledSprite.setFillRange(0.5F);
    filledSprite.setFrame(texture, 0.F, 0.F, 1.F, 1.F, 1.F, 1.F, 0.F, 0.F, 1.F, 1.F, false);
    cc::RenderEntity *filledEntity = filledSprite.getRenderEntity();
    check(filledEntity != nullptr, "filled sprite render entity");
    if (filledEntity != nullptr) {
        filledEntity->prepare(1.F);
        cc::RenderDrawInfo *filledDrawInfo = filledEntity->getStaticRenderDrawInfo(0);
        check(filledDrawInfo != nullptr, "filled sprite draw info");
        if (filledDrawInfo != nullptr) {
            check(filledDrawInfo->getVbCount() == 4, "filled sprite vertex count");
            check(filledDrawInfo->getIbCount() == 6, "filled sprite index count");
        }
    }

    cc::Node tiledNode("native-sprite-tiled");
    cc::UITransform tiledTransform(&tiledNode);
    tiledTransform.setContentSize(200.F, 100.F);
    cc::Sprite tiledSprite;
    tiledSprite.setNode(&tiledNode);
    tiledSprite.setUITransform(&tiledTransform);
    tiledSprite.setMaterial(material);
    tiledSprite.setType(2);
    tiledSprite.setFrame(texture, 0.F, 0.F, 100.F, 100.F, 100.F, 100.F, 0.F, 0.F, 1.F, 1.F, false);
    cc::RenderEntity *tiledEntity = tiledSprite.getRenderEntity();
    check(tiledEntity != nullptr, "tiled sprite render entity");
    if (tiledEntity != nullptr) {
        tiledEntity->prepare(1.F);
        cc::RenderDrawInfo *tiledDrawInfo = tiledEntity->getStaticRenderDrawInfo(0);
        check(tiledDrawInfo != nullptr, "tiled sprite draw info");
        if (tiledDrawInfo != nullptr) {
            check(tiledDrawInfo->getVbCount() == 8, "tiled sprite vertex count");
            check(tiledDrawInfo->getIbCount() == 12, "tiled sprite index count");
        }
    }

    cc::Node radialNode("native-sprite-radial");
    cc::UITransform radialTransform(&radialNode);
    radialTransform.setContentSize(100.F, 100.F);
    cc::Sprite radialSprite;
    radialSprite.setNode(&radialNode);
    radialSprite.setUITransform(&radialTransform);
    radialSprite.setMaterial(material);
    radialSprite.setType(3);
    radialSprite.setFillType(2);
    radialSprite.setFillStart(0.F);
    radialSprite.setFillRange(0.5F);
    radialSprite.setFrame(texture, 0.F, 0.F, 1.F, 1.F, 1.F, 1.F, 0.F, 0.F, 1.F, 1.F, false);
    cc::RenderEntity *radialEntity = radialSprite.getRenderEntity();
    check(radialEntity != nullptr, "radial sprite render entity");
    if (radialEntity != nullptr) {
        radialEntity->prepare(1.F);
        cc::RenderDrawInfo *radialDrawInfo = radialEntity->getStaticRenderDrawInfo(0);
        check(radialDrawInfo != nullptr, "radial sprite draw info");
        if (radialDrawInfo != nullptr) {
            check(radialDrawInfo->getVbCount() == 26, "radial sprite vertex count");
            check(radialDrawInfo->getIbCount() == 72, "radial sprite index count");
        }
    }

    constexpr int kPrepareIterations = 10000;
    const auto start = std::chrono::steady_clock::now();    for (int i = 0; i < kPrepareIterations; ++i) {
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
        testUITransformParity();
        testUITransformScaleParity();
        testUITransformChildBounds();
        testUITransformRotatedParity();
        testComponentAttach();
        testUIOpacity();
        std::printf("uitransform done\n");
        std::fflush(stdout);
        testJsBindings(scriptEngine);
        testJsSceneRecord(scriptEngine);
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
