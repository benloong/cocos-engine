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

#include "2d/framework/UIRendererManager.h"

#include <algorithm>
#include "2d/framework/UIRenderer.h"

namespace cc {

UIRendererManager &UIRendererManager::getInstance() {
    static IntrusivePtr<UIRendererManager> manager(new UIRendererManager());
    return *manager;
}

void UIRendererManager::addRenderer(UIRenderer *renderer) {
    if (renderer->_internalId != -1) return;
    renderer->_internalId = static_cast<int32_t>(_allRenderers.size());
    _allRenderers.push_back(renderer);
}

void UIRendererManager::removeRenderer(UIRenderer *renderer) {
    const auto id = renderer->_internalId;
    if (id == -1) return;
    CC_ASSERT(_allRenderers[id] == renderer);
    _allRenderers.back()->_internalId = id;
    _allRenderers[id] = _allRenderers.back();
    _allRenderers.pop_back();
    renderer->_internalId = -1;
    if (renderer->_dirtyVersion == _dirtyVersion || (_updating && renderer->_dirtyVersion == _dirtyVersion + 1)) {
        auto &queue = renderer->_dirtyVersion == _dirtyVersion ? _dirtyRenderers : _nextDirtyRenderers;
        auto it = std::find(queue.begin(), queue.end(), renderer);
        CC_ASSERT(it != queue.end());
        if (_updating) {
            // Keep every outstanding index stable while callbacks mutate the queue.
            *it = nullptr;
        } else {
            *it = queue.back();
            queue.pop_back();
        }
        renderer->_dirtyVersion = -1;
    }
}

void UIRendererManager::markDirtyRenderer(UIRenderer *renderer) {
    if (renderer->_internalId == -1) return;
    const bool deferred = _updating && renderer->_updatedVersion == _dirtyVersion;
    const auto version = _dirtyVersion + (deferred ? 1 : 0);
    if (renderer->_dirtyVersion == version) return;
    (deferred ? _nextDirtyRenderers : _dirtyRenderers).push_back(renderer);
    renderer->_dirtyVersion = version;
}

void UIRendererManager::updateAllDirtyRenderers() {
    if (_updating) return;
    _updating = true;
    for (size_t i = 0; i < _dirtyRenderers.size(); ++i) {
        UIRenderer *renderer = _dirtyRenderers[i];
        if (!renderer) continue;
        _dirtyRenderers[i] = nullptr;
        renderer->_dirtyVersion = -1;
        renderer->_updatedVersion = _dirtyVersion;
        renderer->_deferredFlags = 0;
        _currentRenderer = renderer;
        renderer->updateRenderer();
        // The callback can destroy renderer; do not access it after returning.
        _currentRenderer = nullptr;
    }
    _dirtyRenderers.clear();
    _dirtyRenderers.swap(_nextDirtyRenderers);
    ++_dirtyVersion;
    _updating = false;
}

} // namespace cc
