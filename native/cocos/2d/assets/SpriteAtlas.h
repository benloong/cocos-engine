/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#pragma once

#include <string>
#include <unordered_map>
#include <vector>

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
    IMPL_EVENT_TARGET(SpriteAtlas)
    DECLARE_TARGET_EVENT_BEGIN(SpriteAtlas)
    TARGET_EVENT_ARG0(AtlasChanged)
    DECLARE_TARGET_EVENT_END()
public:
    using Super = Asset;

    SpriteAtlas() = default;
    ~SpriteAtlas() override = default;

    void addSpriteFrame(const ccstd::string &name, SpriteFrame *frame);
    SpriteFrame *getSpriteFrame(const ccstd::string &name) const;
    void removeSpriteFrame(const ccstd::string &name);
    void clear();
    void setSpriteFrames(const ccstd::vector<ccstd::string> &names, const ccstd::vector<SpriteFrame *> &frames);
    void setSpriteFrameOrder(const ccstd::vector<ccstd::string> &names);
    const ccstd::vector<ccstd::string> &getSpriteFrameNames() const { return _frameNames; }
    uint32_t getSpriteFrameCount() const { return static_cast<uint32_t>(_spriteFrames.size()); }
    uint32_t getRevision() const { return _revision; }
    TextureBase *getTexture() const;

protected:
    bool onPreDestroy() override;

private:
    uint32_t _revision{0};
    // Each named slot owns its frame until removal or deferred atlas destruction.
    ccstd::unordered_map<ccstd::string, IntrusivePtr<SpriteFrame>> _spriteFrames;
    ccstd::vector<ccstd::string> _frameNames;
};

} // namespace cc
