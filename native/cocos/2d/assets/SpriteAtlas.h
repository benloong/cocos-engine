/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#pragma once

#include <string>
#include <unordered_map>

#include "base/Ptr.h"
#include "core/assets/Asset.h"

namespace cc {

class SpriteFrame;
class TextureBase;

/**
 * Native SpriteAtlas thin asset. JS SpriteAtlas keeps the serialized map and
 * forwards named frames here for native ownership and texture access.
 */
class SpriteAtlas final : public Asset {
public:
    using Super = Asset;

    SpriteAtlas() = default;
    ~SpriteAtlas() override = default;

    void addSpriteFrame(const ccstd::string &name, SpriteFrame *frame);
    SpriteFrame *getSpriteFrame(const ccstd::string &name) const;
    void removeSpriteFrame(const ccstd::string &name);
    void clear();
    uint32_t getSpriteFrameCount() const { return static_cast<uint32_t>(_spriteFrames.size()); }
    TextureBase *getTexture() const;

private:
    ccstd::unordered_map<ccstd::string, IntrusivePtr<SpriteFrame>> _spriteFrames;
};

} // namespace cc
