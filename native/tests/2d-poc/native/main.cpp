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
#include "2d/components/Label.h"
#include "2d/components/Graphics.h"
#include "core/builtin/BuiltinResMgr.h"
#include "2d/assets/TTFFont.h"
#include "2d/assets/LabelAtlas.h"
#include "2d/components/Mask.h"
#include "2d/assets/SpriteFrame.h"
#include "2d/assets/SpriteAtlas.h"
#include "2d/framework/UIOpacity.h"
#include "2d/framework/UITransform.h"
#include "2d/renderer/RenderDrawInfo.h"
#include "2d/renderer/RenderEntity.h"
#include "2d/renderer/SpriteGeometry.h"
#include "2d/renderer/RichTextParser.h"
#include "bindings/jswrapper/SeApi.h"
#include "core/Root.h"
#include "core/assets/Material.h"

#include "core/assets/Texture2D.h"
#include "core/assets/RenderTexture.h"
#include "core/assets/ImageAsset.h"
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
bool register_all_assets(se::Object *globalObject);
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

void testSpriteAtlas() {
    cc::IntrusivePtr<cc::SpriteAtlas> atlas(new cc::SpriteAtlas());
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    check(atlas != nullptr && frame != nullptr, "SpriteAtlas/frame allocated");
    atlas->addSpriteFrame("icon", frame);
    check(atlas->getSpriteFrameCount() == 1, "SpriteAtlas count after add");
    check(atlas->getSpriteFrame("icon") == frame, "SpriteAtlas lookup by name");
    atlas->removeSpriteFrame("icon");
    check(atlas->getSpriteFrameCount() == 0, "SpriteAtlas count after remove");
    atlas->addSpriteFrame("icon", frame);
    atlas->clear();
    check(atlas->getSpriteFrameCount() == 0, "SpriteAtlas count after clear");
    const auto retained = frame->getRefCount();
    cc::IntrusivePtr<cc::Texture2D> firstTexture(new cc::Texture2D());
    firstTexture->create(2, 2);
    frame->setTexture(firstTexture);
    atlas->setSpriteFrames({"hero", "empty"}, {frame.get(), nullptr});
    check(atlas->getSpriteFrameCount() == 2, "SpriteAtlas retains null named slots");
    check(atlas->getTexture() == firstTexture, "SpriteAtlas first named slot chooses texture");
    check(frame->getRefCount() == retained + 1, "SpriteAtlas owns loaded frame");
    atlas->setSpriteFrameOrder({"empty", "hero"});
    check(atlas->getTexture() == nullptr, "SpriteAtlas null first slot matches Web");
    atlas->setSpriteFrames({"renamed", "alias"}, {frame.get(), frame.get()});
    check(frame->getRefCount() == retained + 2, "SpriteAtlas replace retains aliases before release");
    check(atlas->getSpriteFrame("hero") == nullptr && atlas->getSpriteFrame("renamed") == frame,
          "SpriteAtlas replace removes old keys");
    for (int i = 0; i < 1000; ++i) {
        atlas->setSpriteFrames({"frame", "empty"}, {frame.get(), nullptr});
        atlas->clear();
    }
    check(frame->getRefCount() == retained, "SpriteAtlas replace/clear releases all frame references");
}
void testSpriteFrameData() {
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D());
    texture->create(128, 256);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    frame->setRect(7, 11, 40, 28);
    frame->setOriginalSize(60, 50);
    frame->setOffset(3, -2);
    frame->setInsets(5, 9, 6, 8);
    frame->setRotated(true);
    frame->loadTexture(texture);
    checkNear(frame->getRectWidth(), 40, "dependency texture preserves serialized rect");
    checkNear(frame->getOriginalWidth(), 60, "dependency texture preserves original size");
    auto uv = frame->getUV();
    check(uv.size() == 8 && frame->getSlicedUV().size() == 32, "native frame UV sizes");
    checkNear(uv[0], 7.F / 128.F, "native frame rotated UV");
    auto border = frame->getTrimmedBorder();
    checkNear(border[0], 13, "native trimmed left border");
    checkNear(border[3], -13, "native trimmed top border");
    cc::IntrusivePtr<cc::SpriteFrame> copy(new cc::SpriteFrame());
    frame->setFlipUVX(true);
    frame->setPivotX(0.25F);
    frame->setPackable(false);
    frame->setAtlasUuid("atlas");
    copy->copyFrom(frame);
    copy->setRectWidth(10);
    checkNear(frame->getRectWidth(), 40, "native clone has independent geometry");
    check(copy->getTexture() == texture && copy->getFlipUVX() && !copy->getPackable(), "native clone copies texture and flags");
    check(copy->getAtlasUuid() == "atlas" && copy->getPivotX() == 0.25F, "native clone copies metadata");
    copy->resetFrame(false);
    checkNear(copy->getRectWidth(), 10, "reset without clear preserves geometry");
    copy->resetFrame(true);
    checkNear(copy->getRectWidth(), 0, "reset clear removes geometry");
    copy->resetWithTexture(texture);
    checkNear(copy->getRectWidth(), 128, "public texture reset uses texture size");
    checkNear(copy->getOriginalHeight(), 256, "public texture reset initializes original size");
    for (int i = 0; i < 1000; ++i) {
        cc::IntrusivePtr<cc::SpriteFrame> temporary(new cc::SpriteFrame());
        temporary->copyFrom(frame);
        temporary->setTexture(nullptr);
    }
    check(frame->getTexture() == texture, "clone/release keeps original texture alive");
}

void testFrameConsumers() {
    std::vector<uint8_t> pixels(16, 255);
    cc::IntrusivePtr<cc::ImageAsset> image(new cc::ImageAsset());
    image->setWidth(2); image->setHeight(2); image->setData(pixels.data());
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D());
    texture->setImage(image);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    frame->resetWithTexture(texture);
    cc::IntrusivePtr<cc::Material> material(new cc::Material());
    cc::Node labelNode("frame-bmfont");
    cc::UITransform labelTransform(&labelNode);
    cc::Label label;
    label.setNode(&labelNode);
    label.setUITransform(&labelTransform);
    label.setMaterial(material);
    label.setBitmapAtlas(frame, 2);
    label.addGlyph(65, 0, 0, 2, 2, 0, 0, 2);
    label.setString("A");
    label.prepareRenderEntity(1.F);
    check(label.getOpaquePixels() == 4, "BMFont consumes native SpriteFrame texture");

    cc::Node maskNode("frame-mask");
    cc::UITransform maskTransform(&maskNode);
    cc::Mask mask;
    mask.setNode(&maskNode);
    mask.setUITransform(&maskTransform);
    mask.setMaterial(material);
    mask.setType(3);
    mask.setSpriteFrame(frame);
    auto *entity = static_cast<cc::RenderEntity *>(maskNode.getUserData());
    check(entity != nullptr, "sprite stencil has native entity");
    if (entity) {
        entity->prepare(1.F);
        check(entity->getStaticDrawInfoSize() == 1, "Mask consumes native SpriteFrame");
        frame->setRectWidth(1);
        entity->prepare(1.F);
        checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[12], 0.5F, "Mask sees in-place frame rect mutation");
    }

    std::vector<uint8_t> transparentPixels(16, 0);
    cc::IntrusivePtr<cc::ImageAsset> transparentImage(new cc::ImageAsset());
    transparentImage->setWidth(2); transparentImage->setHeight(2); transparentImage->setData(transparentPixels.data());
    cc::IntrusivePtr<cc::Texture2D> transparentTexture(new cc::Texture2D());
    transparentTexture->setImage(transparentImage);
    frame->setTexture(transparentTexture);
    label.prepareRenderEntity(1.F);
    check(label.getOpaquePixels() == 0, "BMFont sees shared frame texture replacement");
}

void testFontAssets() {
    cc::IntrusivePtr<cc::TTFFont> ttf(new cc::TTFFont());
    std::vector<uint8_t> bytes{1, 2, 3};
    ttf->setFontData(bytes); bytes[0] = 9;
    check(ttf->getFontData()[0] == 1, "TTF owns copied bytes");
    check(!ttf->loadFontData("missing-font.ttf") && ttf->getFontDataSize() == 3, "TTF failed load preserves data");
    ttf->setFontFamily("Test Family");
    cc::IntrusivePtr<cc::LabelAtlas> font(new cc::LabelAtlas());
    const std::string config = R"({"fontDefDictionary":{"65":{"rect":{"x":0,"y":0,"width":2,"height":2},"xAdvance":2}},"kerningDict":{"4259905":-1}})";
    check(font->setConfigJson(config), "native bitmap config accepted");
    checkNear(font->getKerning(65, 65), -1, "packed kerning decoded");
    check(font->setConfigJson(R"({"kerningDict":{"-65471":-3}})"), "signed packed kerning");
    checkNear(font->getKerning(65535, 65), -3, "signed kerning key decoded");
    font->setConfigJson(config);
    const auto revision = font->getRevision();
    check(!font->setConfigJson("{bad") && font->getRevision() == revision && font->getGlyphCount() == 1, "invalid config atomic");
    check(font->setConfigJson(R"({"kerningDict":{"65":{"128512":-2}}})"), "nested Unicode kerning");
    checkNear(font->getKerning(65, 128512), -2, "Unicode kerning retained");
    font->setConfigJson(config); font->setFontSize(2);
    std::vector<uint8_t> pixels(16, 255);
    cc::IntrusivePtr<cc::ImageAsset> image(new cc::ImageAsset());
    image->setWidth(2); image->setHeight(2); image->setData(pixels.data());
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->setImage(image);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame()); frame->resetWithTexture(texture);
    font->setSpriteFrame(frame);
    cc::Node node("font-asset"); cc::UITransform transform(&node);
    cc::IntrusivePtr<cc::Material> material(new cc::Material());
    cc::Label label;
    label.setNode(&node); label.setUITransform(&transform); label.setMaterial(material);
    label.setFontSize(2); label.setLineHeight(2); label.setString("A"); label.setCacheMode(2);
    const auto refs = font->getRefCount();
    label.setFontAsset(font); label.prepareRenderEntity(1.F);
    check(label.getOpaquePixels() == 4, "LabelAtlas native glyph renders even in CHAR mode");
    check(font->getRefCount() == refs + 1, "Label retains font asset");
    { cc::Label second; second.setFontAsset(font); check(font->getRefCount() == refs + 2, "labels share font ownership"); }
    check(font->getRefCount() == refs + 1, "Label destructor releases font");
    font->setConfigJson("null"); label.prepareRenderEntity(1.F);
    check(label.getOpaquePixels() == 0 && label.getContentWidth() == 0, "config revision clears stale render data");
    font->setConfigJson(config); label.prepareRenderEntity(1.F);
    check(label.getOpaquePixels() == 4, "config replacement refreshes existing Label");
    font->setSpriteFrame(nullptr); label.prepareRenderEntity(1.F);
    check(label.getOpaquePixels() == 0, "frame detach clears Label");
    font->setSpriteFrame(frame);
    for (int i = 0; i < 1000; ++i) { label.setFontAsset(ttf); label.setFontAsset(font); label.setFontAsset(nullptr); }
    check(font->getRefCount() == refs, "repeated switching releases font ownership");
    label.setFontAsset(font); font->destroy(); label.prepareRenderEntity(1.F);
    check(font->isReleased() && !font->getSpriteFrame() && !font->getGlyphCount(), "destroy releases bitmap data immediately");
    check(label.getOpaquePixels() == 0, "destroyed font clears attached Label");
    label.setFontAsset(nullptr);
    ttf->destroy(); check(ttf->getFontDataSize() == 0 && ttf->getFontFamily().empty(), "TTF destroy releases data and alias");
    cc::CCObject::deferredDestroy();
    std::printf("font assets: PASS\n");
}

void testRichTextParser() {
    const auto spans = cc::RichTextParser::parse("<color=red>A<size=0>B</size><b click=\"tap\" param=\"arg\">C</b><img src=\"icon\" width=16 height=20/>D</color>");
    check(spans.size() == 5, "RichText emits text and image spans");
    if (spans.size() == 5) {
        check(spans[0].style && spans[0].style->color == "red", "RichText native color");
        check(spans[1].style && spans[1].style->size == 0 && spans[1].style->color == "red", "RichText zero property survives absent parent property");
        check(spans[2].style && spans[2].style->bold && spans[2].style->event
              && spans[2].style->event->at("click") == "tap" && spans[2].style->event->at("param") == "arg", "RichText native click metadata");
        check(spans[3].style && spans[3].style->isImage && spans[3].style->src == "icon"
              && spans[3].style->imageWidth == 16 && !spans[3].style->color, "RichText image attributes have Web inheritance boundary");
    }
    const auto inherited = cc::RichTextParser::parse("<size=24><size=0>x</size></size>");
    check(inherited.size() == 1 && inherited[0].style && inherited[0].style->size == 24, "RichText falsy child inherits present parent property");
    const auto tail = cc::RichTextParser::parse("<b>tail");
    check(tail.size() == 1 && !tail[0].style, "RichText preserves Web unclosed-tail behavior");
    const auto entities = cc::RichTextParser::parse("&amp;lt;&lt;&quot;&apos;");
    check(entities.size() == 1 && entities[0].text == "&lt;<\"'", "RichText entity replacement order");
    for (int i = 0; i < 1000; ++i) {
        const auto text = cc::RichTextParser::parse(i % 2 ? "<b>x</b>" : "");
        check(text.size() == (i % 2 ? 1U : 0U), "RichText parser calls retain no previous spans");
    }
    std::printf("rich text parser: PASS\n");
}

void testLayoutAndMaterials() {
    cc::UITransform transform;
    int changes = 0;
    auto owner = std::make_shared<int>(1);
    std::weak_ptr<int> weak = owner;
    transform.setSizeChangedCallback([&, owner](float width, float height) { ++changes; });
    owner.reset();
    transform.setContentSize(80, 20); transform.setContentSize(80, 20);
    check(changes == 1 && !weak.expired(), "size callback fires only on mutation and owns closure");
    transform.detach();
    check(weak.expired(), "detach releases size callback ownership");
    transform.setContentSize(90, 30); check(changes == 1, "no callback after detach");
    cc::IntrusivePtr<cc::Material> builtin(new cc::Material());
    cc::BuiltinResMgr::getInstance()->addAsset("ui-sprite-material", builtin);
    cc::Label label;
    check(label.getRenderMaterial() == builtin, "Label resolves builtin material in native");
    cc::IntrusivePtr<cc::Material> custom(new cc::Material()); label.setMaterial(custom);
    check(label.getRenderMaterial() == custom, "Label custom material overrides default");
    cc::Node labelNode("label-material-slots"); cc::UITransform labelUI(&labelNode);
    label.setNode(&labelNode); label.setUITransform(&labelUI);
    label.setFontSize(16); label.setLineHeight(20); label.setString("material");
    auto *labelEntity = static_cast<cc::RenderEntity *>(labelNode.getUserData());
    label.prepareRenderEntity(1.F);
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 1
          && labelEntity->getStaticRenderDrawInfo(0)->getMaterial() == custom, "Label submits custom slot material");
    cc::IntrusivePtr<cc::Material> labelInstance(label.getMaterialInstance(0));
    label.prepareRenderEntity(1.F);
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 1
          && labelEntity->getStaticRenderDrawInfo(0)->getMaterial() == labelInstance, "Label submits actual native instance");
    label.setSharedMaterial(nullptr, 0); label.prepareRenderEntity(1.F);
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 0, "explicit empty Label slot clears old draw info");
    label.setMaterial(nullptr); label.prepareRenderEntity(1.F);
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 1
          && labelEntity->getStaticRenderDrawInfo(0)->getMaterial() == builtin, "Label custom clear restores builtin submission");
    label.setSharedMaterial(custom, 2);
    const auto retainedRefs = custom->getRefCount();
    check(label.getSharedMaterialCount() == 3, "secondary Label slots have native array extent");
    label.resizeMaterials(1);
    check(label.getSharedMaterialCount() == 1 && custom->getRefCount() < retainedRefs, "shrinking Label slots releases shared references");
    label.resizeMaterials(0); label.prepareRenderEntity(1.F);
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 0, "empty Label array clears renderer");
    label.setNode(nullptr); label.setUITransform(nullptr);
    cc::Node node("graphics-default-material"); cc::UITransform ui(&node);
    cc::Graphics graphics; graphics.setNode(&node); graphics.setUITransform(&ui);
    graphics.rect(0, 0, 4, 4); graphics.fill();
    auto *entity = static_cast<cc::RenderEntity *>(node.getUserData());
    if (entity) {
        entity->prepare(1.F);
        check(entity->getStaticDrawInfoSize() == 1 && entity->getStaticRenderDrawInfo(0)->getMaterial() == builtin, "Graphics native draw uses builtin material");
    } else check(false, "Graphics has render entity");
    std::printf("layout/material ownership: PASS\n");
}

void testSpriteApiAndMaterials() {
    auto *resources = cc::BuiltinResMgr::getInstance();
    cc::IntrusivePtr<cc::Material> normal(new cc::Material()), gray(new cc::Material()), alpha(new cc::Material()), grayAlpha(new cc::Material());
    resources->addAsset("ui-sprite-material", normal);
    normal = resources->get<cc::Material>("ui-sprite-material");
    resources->addAsset("ui-sprite-gray-material", gray);
    resources->addAsset("ui-sprite-alpha-sep-material", alpha);
    resources->addAsset("ui-sprite-gray-alpha-sep-material", grayAlpha);
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->create(4,4);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame()); frame->resetWithTexture(texture);
    const auto textureRefs = texture->getRefCount(), frameRefs = frame->getRefCount();
    cc::Sprite sprite; sprite.setFrame(frame);
    check(texture->getRefCount() == textureRefs + 1 && frame->getRefCount() == frameRefs + 1, "Sprite retains frame and texture");
    checkNear(sprite.getFillRange(), 0, "Sprite default fillRange matches Web");
    sprite.setFillStart(2); sprite.setFillRange(-2);
    checkNear(sprite.getFillStart(), 1, "native fillStart clamp"); checkNear(sprite.getFillRange(), -1, "native fillRange clamp");
    check(sprite.getRenderMaterial() == normal && sprite.getSharedMaterial(0) == normal, "native normal/shared builtin selection");
    sprite.setGrayscale(true); check(sprite.getRenderMaterial() == gray, "native grayscale variant");
    // These exercise format-driven selection, not compressed texture decoding.
    texture->_format = cc::PixelFormat::RGBA_ETC1;
    check(sprite.getRenderMaterial() == grayAlpha, "native grayscale/alpha-separated variant");
    sprite.setGrayscale(false); check(sprite.getRenderMaterial() == alpha, "native alpha-separated variant");
    texture->_format = cc::PixelFormat::RGB_A_PVRTC_4BPPV1;
    check(sprite.getRenderMaterial() == alpha, "native PVRTC4 alpha variant");
    texture->_format = cc::PixelFormat::RGB_A_PVRTC_2BPPV1;
    check(sprite.getRenderMaterial() == alpha, "native PVRTC2 alpha variant");
    texture->_format = cc::PixelFormat::RGBA8888;
    sprite.setGrayscale(true);
    cc::IntrusivePtr<cc::Material> instance(sprite.getMaterialInstance(0));
    check(instance != gray && instance->getParent() == gray, "material instance keeps native parent");
    sprite.refreshMaterial(); frame->setRectWidth(3); sprite.setFrame(frame);
    check(sprite.getMaterialInstance(0) == instance, "geometry and unchanged variant preserve instance");
    sprite.setGrayscale(false); check(sprite.getRenderMaterial() == normal, "variant change invalidates old instance");
    sprite.setGrayscale(true);
    cc::IntrusivePtr<cc::Material> custom(new cc::Material()); const auto materialRefs = custom->getRefCount();
    sprite.setMaterial(custom); sprite.setGrayscale(true); sprite.refreshMaterial();
    check(sprite.getRenderMaterial() == custom && custom->getRefCount() > materialRefs, "custom material wins and is retained");
    sprite.setMaterial(nullptr); check(sprite.getRenderMaterial() == gray && custom->getRefCount() == materialRefs, "clear custom returns to builtin and releases reference");
    sprite.setSharedMaterial(custom,0); check(sprite.getRenderMaterial() == custom, "shared material replacement affects renderer");
    sprite.setSharedMaterial(nullptr,0); check(sprite.getRenderMaterial() == nullptr, "shared material clear removes render slot");
    sprite.setSharedMaterial(custom,1); auto *secondInstance = sprite.getMaterialInstance(1);
    check(secondInstance != custom && secondInstance->getParent() == custom && sprite.getRenderMaterial(1) == secondInstance, "secondary material instance is independent");
    sprite.setMaterialInstance(nullptr,1); check(sprite.getRenderMaterial(1) == nullptr, "secondary instance clear releases slot");
    sprite.setSharedMaterial(custom,0); auto *promoted = sprite.getMaterialInstance(0);
    sprite.setSharedMaterial(promoted,0);
    check(sprite.getSharedMaterial(0) == promoted && promoted->getParent() == custom, "instance promotion retains before cache release");
    sprite.setSharedMaterial(nullptr,0);
    check(custom->getRefCount() == materialRefs, "all material slots release custom reference");
    sprite.setMaterial(nullptr);
    cc::IntrusivePtr<cc::RenderTexture> rt(new cc::RenderTexture());
    sprite.setFrame(rt,0,0,4,4,4,4,0,0,4,4,false);
    check(frame->getRefCount() == frameRefs, "scalar frame replacement drops old asset");
    auto *rtMaterial = sprite.getRenderMaterial();
    check(rtMaterial && rtMaterial != gray && !rtMaterial->_defines.empty()
          && cc::macroRecordAsBool(rtMaterial->_defines[0].at("SAMPLE_FROM_RT")), "native RenderTexture variant includes macro");
    sprite.setEnabled(false); sprite.setFrame(frame);
    check(!sprite.getRenderEntity()->isEnabled(), "frame assignment preserves disabled Sprite state");
    sprite.clearFrame();
    check(frame->getRefCount() == frameRefs && texture->getRefCount() == textureRefs, "clearFrame releases frame and texture");
    cc::Node node("sprite-shape-updates"); cc::UITransform ui(&node); ui.setContentSize(100,100);
    cc::Sprite dynamic; dynamic.setNode(&node); dynamic.setUITransform(&ui); dynamic.setSizeMode(0); dynamic.setFrame(frame);
    dynamic.setType(3); dynamic.setFillStart(0); dynamic.setFillRange(0.5F); dynamic.prepare(1.F);
    auto *entity = dynamic.getRenderEntity();
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], -50, "initial bar origin");
    ui.setContentSize(200,100); dynamic.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], -100, "native size change refreshes vertices");
    node.setPosition(20,0,0); dynamic.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], -80, "native Node movement refreshes vertices");
    ui.setAnchorPoint(0,0); dynamic.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], 20, "native anchor change refreshes vertices");
    dynamic.setFillRange(0); dynamic.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 0, "zero fill clears previous draw data");
    dynamic.setFillRange(0.5F); dynamic.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 1, "nonzero fill restores draw data");
    dynamic.setEnabled(false); dynamic.prepare(1.F); check(!entity->isEnabled(), "manual prepare preserves disabled entity");
    cc::Node radialNode("radial-state"); cc::UITransform radialUI(&radialNode); radialUI.setContentSize(100,100);
    cc::Sprite radial; radial.setNode(&radialNode); radial.setUITransform(&radialUI); radial.setSizeMode(0);
    radial.setType(3); radial.setFillType(2); radial.setFillRange(0.5F); radial.setFillCenter(0.5F,0.5F);
    frame->setRect(0.5F,0.25F,2,1); radial.setFrame(frame);
    for(int flags=0;flags<8;flags++) {
        frame->setRotated((flags&1)!=0); frame->setFlipUVX((flags&2)!=0); frame->setFlipUVY((flags&4)!=0);
        radial.prepare(1.F);
        cc::FilledSpriteGeometryParams p; p.contentSize=cc::Vec2(100,100); p.frameRect=cc::Rect(0.5F,0.25F,2,1);
        p.textureSize=cc::Vec2(4,4); p.fillCenter=cc::Vec2(0.5F,0.5F); p.fillRange=0.5F; p.rotated=(flags&1)!=0;
        const auto expected=cc::buildRadialSpriteMesh(p); const auto *draw=radial.getRenderEntity()->getStaticRenderDrawInfo(0);
        check(draw->getVbCount()==expected.vertices.size(), "radial component uses Web triangle layout");
        for(size_t v=0;v<expected.vertices.size();v++) {
            checkNear(draw->getVDataBuffer()[v*9+3], expected.vertices[v].uv.x, "radial follows Web rotation/flip U convention");
            checkNear(draw->getVDataBuffer()[v*9+4], expected.vertices[v].uv.y, "radial follows Web rotation/flip V convention");
        }
    }
    std::printf("sprite API/materials: PASS\n");
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
    // Match production: scene MaterialInstance derives from assets Material.
    check(register_all_assets(globalObject), "register_all_assets");
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
        "    var sf = new jsb.SpriteFrame();"
        "    sf.setRect(0, 0, 1, 1);"
        "    sf.setOriginalSize(1, 1);"
        "    sf.setOffset(0, 0);"
        "    sf.setRotated(false);"
        "    sf.setInsets(1, 2, 3, 4);"
        "    var clone = new jsb.SpriteFrame();"
        "    clone.copyFrom(sf);"
        "    clone.setRectWidth(7);"
        "    if (sf.getRectWidth() !== 1 || clone.getRectWidth() !== 7) return 'frame copy shares data';"
        "    if (sf.getInsetTop() !== 3) return 'frame inset order';"
        "    if (sf.getPixelsToUnit() !== 100 || sf.getPivotX() !== 0.5) return 'frame defaults';"
        "    var revision = sf.getRevision();"
        "    sf.setFlipUVX(true);"
        "    if (!sf.getFlipUVX() || sf.getRevision() === revision) return 'frame flip revision';"
        "    if (sf.getUV().length !== 0) return 'missing texture UV';"
        "    var texture = new jsb.Texture2D();"
        "    texture.create(128, 256);"
        "    sf.setTexture(texture);"
        "    sf.setRect(7, 11, 40, 28);"
        "    sf.setRotated(true);"
        "    sf.setFlipUVX(false);"
        "    if (sf.getUV().length !== 8 || sf.getSlicedUV().length !== 32) return 'frame UV binding conversion';"
        "    if (Math.abs(sf.getUV()[0] - 7 / 128) > 0.000001) return 'frame UV binding values';"
        "    sf.resetFrame(true);"
        "    if (sf.getRectWidth() !== 0 || sf.getInsetLeft() !== 0) return 'frame reset';"
        "    var atlas = new jsb.SpriteAtlas();"
        "    atlas.addSpriteFrame('icon', sf);"
        "    if (atlas.getSpriteFrameCount() !== 1) return 'unexpected atlas count';"
        "    if (!atlas.getSpriteFrame('icon')) return 'unexpected atlas lookup';"
        "    atlas.setSpriteFrames(['hero', 'empty'], [sf, null]);"
        "    if (atlas.getSpriteFrameCount() !== 2) return 'atlas null slot count';"
        "    if (atlas.getSpriteFrameNames().join(',') !== 'hero,empty') return 'atlas names conversion';"
        "    if (atlas.getSpriteFrame('hero') !== sf) return 'atlas frame vector conversion';"
        "    if (atlas.getTexture() !== texture) return 'atlas first texture';"
        "    atlas.setSpriteFrameOrder(['empty', 'hero']);"
        "    if (atlas.getTexture() !== null) return 'atlas first null slot texture';"
        "    atlas.clear();"
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
    check(sprite.getMaterialInstance(0)->getParent() == material, "ui renderer creates a native material instance");
    check(sprite.getTypeId() == cc::Sprite::TYPE_ID, "sprite type id");
    sprite.setColorRGBA(10.F, 20.F, 30.F, 255.F);
    check(sprite.getColor().r == 10 && sprite.getColor().g == 20 && sprite.getColor().b == 30, "ui renderer color");
    sprite.setPriority(7);
    check(sprite.getPriority() == 7, "ui renderer priority");
    sprite.setFrame(texture, 0.F, 0.F, 1.F, 1.F, 1.F, 1.F, 0.F, 0.F, 1.F, 1.F, false);

    cc::Node sizeNode("native-sprite-size-mode");
    cc::UITransform sizeTransform(&sizeNode);
    sizeTransform.setContentSize(100.F, 100.F);
    cc::Sprite sizeSprite;
    sizeSprite.setNode(&sizeNode);
    sizeSprite.setUITransform(&sizeTransform);
    auto *sizeFrame = new cc::SpriteFrame();
    sizeFrame->setTexture(texture);
    sizeFrame->setRect(0.F, 0.F, 50.F, 60.F);
    sizeFrame->setOriginalSize(80.F, 90.F);
    sizeSprite.setSizeMode(1);
    sizeSprite.setFrame(sizeFrame);
    check(sizeTransform.getContentSize().x == 50.F && sizeTransform.getContentSize().y == 60.F,
          "sprite trimmed size mode uses frame rect");
    sizeSprite.setSizeMode(2);
    check(sizeTransform.getContentSize().x == 80.F && sizeTransform.getContentSize().y == 90.F,
          "sprite raw size mode uses original size");

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
        check(drawInfo->getMaterial() == sprite.getRenderMaterial(), "sprite uses active material instance");
        check(drawInfo->getTexture() == texture->getGFXTexture(), "sprite texture");
    }

    // Mutating a shared native frame must invalidate idle sprites without
    // JS reassigning spriteFrame. Check real render buffers in all five modes.
    cc::IntrusivePtr<cc::SpriteFrame> mutableFrame(new cc::SpriteFrame());
    mutableFrame->setTexture(texture);
    mutableFrame->setOriginalSize(1.F, 1.F);
    mutableFrame->setRect(0.F, 0.F, 1.F, 1.F);
    cc::Sprite otherSprite;
    cc::Node otherNode("shared-frame");
    cc::UITransform otherTransform(&otherNode);
    otherTransform.setContentSize(100.F, 100.F);
    otherSprite.setNode(&otherNode);
    otherSprite.setUITransform(&otherTransform);
    otherSprite.setMaterial(material);
    otherSprite.setSizeMode(0);
    sprite.setSizeMode(0);
    sprite.setFrame(mutableFrame);
    otherSprite.setFrame(mutableFrame);
    sprite.setFillRange(1.F); // Filled tests must request a nonempty interval.
    for (int mode = 0; mode < 5; ++mode) {
        sprite.setType(mode < 3 ? mode : 3);
        sprite.setFillType(mode == 4 ? 2 : 0);
        mutableFrame->setFlipUVX(false);
        mutableFrame->setRectWidth(1.F);
        entity->prepare(1.F);
        mutableFrame->setRectWidth(0.5F);
        entity->prepare(1.F);
        otherSprite.prepare(1.F);
        auto *info = entity->getStaticRenderDrawInfo(0);
        check(info && info->getVbCount() > 0, "frame revision rebuilds all sprite modes");
        if (info) {
            const float *vertices = info->getVDataBuffer();
            for (uint32_t i = 0; i < info->getVbCount(); ++i) {
                check(vertices[i * 9 + 3] <= 0.50001F, "in-place rect mutation updates native UV");
            }
        }
    }
    sprite.setType(0);
    mutableFrame->setFlipUVX(true);
    sprite.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[3], 0.5F, "flip mutation rebuilds idle sprite");
    checkNear(otherSprite.getRenderEntity()->getStaticRenderDrawInfo(0)->getVDataBuffer()[12], 0.5F,
              "shared frame mutation reaches second sprite");
    mutableFrame->setTexture(nullptr);
    sprite.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 0, "cleared texture removes stale draw info");
    mutableFrame->setTexture(texture);
    sprite.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 1, "resolved texture restores draw info");
    mutableFrame->setRect(0.25F, 0.125F, 0.5F, 0.25F);
    for (int flags = 0; flags < 8; ++flags) {
        mutableFrame->setRotated((flags & 1) != 0);
        mutableFrame->setFlipUVX((flags & 2) != 0);
        mutableFrame->setFlipUVY((flags & 4) != 0);
        for (int type = 0; type < 2; ++type) {
            sprite.setType(type);
            sprite.prepare(1.F);
            const auto expected = type == 0 ? mutableFrame->getUV() : mutableFrame->getSlicedUV();
            const auto *info = entity->getStaticRenderDrawInfo(0);
            const float *vertices = info->getVDataBuffer();
            check(info->getVbCount() * 2 == expected.size(), "Sprite and asset UV layouts agree");
            for (uint32_t i = 0; i < info->getVbCount(); ++i) {
                checkNear(vertices[i * 9 + 3], expected[i * 2], "Sprite consumes frame rotation/flip U convention");
                checkNear(vertices[i * 9 + 4], expected[i * 2 + 1], "Sprite consumes frame rotation/flip V convention");
            }
        }
    }

    cc::Node slicedNode("native-sprite-sliced");
    cc::UITransform slicedTransform(&slicedNode);
    slicedTransform.setContentSize(200.F, 200.F);
    cc::Sprite slicedSprite;
    slicedSprite.setNode(&slicedNode);
    slicedSprite.setUITransform(&slicedTransform);
    slicedSprite.setMaterial(material);
    slicedSprite.setType(1);
    auto *slicedFrame = new cc::SpriteFrame();
    slicedFrame->setTexture(texture);
    slicedFrame->setRect(0.F, 0.F, 1.F, 1.F);
    slicedFrame->setOriginalSize(1.F, 1.F);
    slicedFrame->setInsets(0.F, 0.F, 0.F, 0.F);
    slicedSprite.setFrame(slicedFrame);
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
    radialSprite.setFillCenter(0.5F,0.5F);
    radialSprite.setFrame(texture, 0.F, 0.F, 1.F, 1.F, 1.F, 1.F, 0.F, 0.F, 1.F, 1.F, false);
    cc::RenderEntity *radialEntity = radialSprite.getRenderEntity();
    check(radialEntity != nullptr, "radial sprite render entity");
    if (radialEntity != nullptr) {
        radialEntity->prepare(1.F);
        cc::RenderDrawInfo *radialDrawInfo = radialEntity->getStaticRenderDrawInfo(0);
        check(radialDrawInfo != nullptr, "radial sprite draw info");
        if (radialDrawInfo != nullptr) {
            check(radialDrawInfo->getVbCount() == 9, "radial sprite vertex count");
            check(radialDrawInfo->getIbCount() == 9, "radial sprite index count");
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

int main(int argc, char **argv) {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    _set_error_mode(_OUT_TO_STDERR);
    _set_abort_behavior(0, _WRITE_ABORT_MSG | _CALL_REPORTFAULT);
#endif
    // Node's shared-memory bridge needs a running script engine; Root/Device
    // are required by the surrounding engine singletons.
    cc::Root *root = new cc::Root(cc::gfx::DeviceManager::create());
    cc::BuiltinResMgr builtins;
    auto *scriptEngine = new se::ScriptEngine();
    auto *files = cc::createFileUtils();
    scriptEngine->start();
    {
        se::AutoHandleScope scope;
        testSpriteAtlas();
        testSpriteFrameData();
        testFrameConsumers();
        testFontAssets();
        testRichTextParser();
        testLayoutAndMaterials();
        testSpriteApiAndMaterials();
        std::printf("sprite atlas done\n");
        std::fflush(stdout);
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
        if (argc > 1) {
            std::ifstream stream(argv[1]);
            const std::string script((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
            se::Value result;
            const bool ok = !script.empty() && scriptEngine->evalString(script.c_str(), static_cast<uint32_t>(script.size()), &result);
            check(ok && result.isString() && result.toString() == "OK", "JSB shell integration probe");
            std::printf("jsb shell integration: %s\n", result.isString() ? result.toString().c_str() : "FAIL");
        }
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
    delete files;

    std::printf("native 2D PoC: %s\n", gFailures == 0 ? "PASS" : "FAIL");
    return gFailures == 0 ? 0 : 1;
}
