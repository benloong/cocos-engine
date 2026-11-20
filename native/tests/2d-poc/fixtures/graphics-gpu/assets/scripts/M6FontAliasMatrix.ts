import { assetManager, Director, director, isValid, Label, native, Node, sys, TTFFont, UITransform } from 'cc';

const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
const expectedWidths = [95.9765625, 101.9296875];
const expectedBytes = [223404, 217360];

export async function checkFontAliasSources (parent: Node, capture: (name: string) => Promise<void>): Promise<object> {
    const origin = sys.isNative ? native.fileUtils.getStringFromFile('m6-font-http-origin.txt').trim() : '';
    const urls = ['a', 'b'].map(dir => `${origin}/m6-font-alias/${dir}/Shared.ttf`);
    const load = (url: string): Promise<TTFFont> => new Promise((resolve, reject) => {
        assetManager.loadRemote<TTFFont>(url, { ext: '.ttf' }, (error, asset) => error ? reject(error) : resolve(asset!));
    });
    const checkpoints: object[] = [];
    const retired = new Set<TTFFont>();
    for (const order of [[0, 1], [1, 0]]) {
        const [first, second] = order;
        const owners = new Map(await Promise.all(order.map(async index => {
            const asset = (await load(urls[index])).addRef();
            if (retired.has(asset) || assetManager.assets.get(urls[index]) !== asset) throw new Error('Same-name TTF reused a released owner');
            if (sys.isNative) {
                const font = asset as TTFFont & { getFontDataSize(): number };
                if (font.getFontDataSize() !== expectedBytes[index]) throw new Error(`Same-name TTF source ${index} returned ${font.getFontDataSize()} bytes`);
            }
            const node = new Node(`same-name-font-${index}`);
            node.layer = parent.layer;
            node.setPosition(0, index ? -30 : 30, 0);
            parent.addChild(node);
            const ui = node.addComponent(UITransform);
            const label = node.addComponent(Label);
            label.font = asset;
            label.useSystemFont = false;
            label.fontSize = 24;
            label.string = 'Atlas 123';
            return [index, { asset, node, label, ui, family: asset._nativeAsset! }] as const;
        })));
        const faces = (family: string): number => Array.from(document.fonts).filter(face => face.family === family).length;
        const verify = (indices: number[]): number[] => indices.map(index => {
            const { asset, label, ui, family } = owners.get(index)!;
            label.updateRenderData(true);
            if (Math.abs(ui.width - expectedWidths[index]) > 0.001 || !isValid(asset) || assetManager.assets.get(urls[index]) !== asset) {
                throw new Error(`Same-name TTF source ${index} rendered width ${ui.width}, expected ${expectedWidths[index]}`);
            }
            if (!sys.isNative && faces(family) !== 1) throw new Error(`Same-name TTF ${index} did not have one live FontFace`);
            return ui.width;
        });
        const release = async (index: number): Promise<void> => {
            const { asset, node, family } = owners.get(index)!;
            node.destroy();
            await nextFrame();
            asset.decRef();
            for (let i = 0; i < 8 && isValid(asset); ++i) await nextFrame();
            if (isValid(asset) || assetManager.assets.has(urls[index]) || (!sys.isNative && faces(family))) {
                throw new Error(`Same-name TTF source ${index} remained registered`);
            }
            retired.add(asset);
        };
        await nextFrame();
        const both = verify([0, 1]);
        if (!sys.isNative && owners.get(first)!.family === owners.get(second)!.family) throw new Error('Different browser font sources shared a rendering alias');
        const before = `font-alias-both-${first}`;
        await capture(before);
        checkpoints.push({ name: before, widths: both });
        await release(first);
        const survivor = verify([second]);
        const after = `font-alias-only-${second}`;
        await capture(after);
        checkpoints.push({ name: after, widths: survivor });
        await release(second);
    }
    return { checkpoints, released: retired.size };
}
