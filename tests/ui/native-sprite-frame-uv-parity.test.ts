import { readFileSync } from 'fs';
import { SpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { Rect } from '../../cocos/core';

// Run through native/tests/2d-poc/run-m6-sprite-frame-tests.ps1, which builds
// and executes the C++ implementation before enabling this cross-runtime test.
const fixture = process.env.CC_SPRITE_FRAME_UV_FIXTURE;
(fixture ? test : test.skip)('native SpriteFrame UV matches Web for rotation, flips, slicing and zero texture sizes', () => {
    const cases = JSON.parse(readFileSync(fixture!, 'utf8'));
    expect(cases).toHaveLength(32);
    for (const item of cases) {
        const frame = new SpriteFrame();
        (frame as any)._texture = { width: item.width, height: item.height };
        (frame as any)._rect = new Rect(7, 11, 40, 28);
        (frame as any)._capInsets = [5, 6, 9, 8];
        (frame as any)._rotated = item.rotated;
        (frame as any)._isFlipUVX = item.flipX;
        (frame as any)._isFlipUVY = item.flipY;
        frame._calculateUV();
        for (let i = 0; i < 8; ++i) expect(item.uv[i]).toBeCloseTo(frame.uv[i], 6);
        expect(item.uv.every(Number.isFinite)).toBe(true);
        // Web sliced UV divides by zero; native deliberately returns finite
        // placeholder coordinates until dimensions are available.
        if (item.width && item.height) {
            const sliced = frame.uvSliced.flatMap(({ u, v }) => [u, v]);
            for (let i = 0; i < 32; ++i) expect(item.sliced[i]).toBeCloseTo(sliced[i], 6);
        }
        expect(item.sliced.every(Number.isFinite)).toBe(true);
    }
});
