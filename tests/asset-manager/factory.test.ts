import { Asset } from '../../cocos/asset/assets/asset';
import { Factory } from '../../cocos/asset/asset-manager/factory';
import { assets } from '../../cocos/asset/asset-manager/shared';

test('a producer exception completes all joined requests and permits a same-ID retry', () => {
    const factory = new Factory();
    const first = jest.fn(), joined = jest.fn();
    const failure = new Error('font construction failed');
    factory.register('.test', (id, data, options) => {
        factory.create(id, data, '.test', options, joined);
        throw failure;
    });
    factory.create('factory-throw', null, '.test', { cacheAsset: false }, first);
    expect(first).toHaveBeenCalledTimes(1);
    expect(joined).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(failure, null);
    expect(joined).toHaveBeenCalledWith(failure, null);
    expect(assets.has('factory-throw')).toBe(false);

    const result = new Asset(), retried = jest.fn();
    factory.register('.test', (_id, _data, _options, complete) => complete(null, result));
    factory.create('factory-throw', null, '.test', { cacheAsset: false }, retried);
    expect(retried).toHaveBeenCalledWith(null, result);
});

test('late completions cannot finish a replacement request or call old consumers twice', () => {
    const factory = new Factory();
    const first = jest.fn(), second = jest.fn();
    let oldComplete: any, newComplete: any;
    factory.register('.test', (_id, _data, _options, complete) => {
        oldComplete = complete;
        throw new Error('producer stopped');
    });
    factory.create('factory-late', null, '.test', {}, first);
    factory.register('.test', (_id, _data, _options, complete) => { newComplete = complete; });
    factory.create('factory-late', null, '.test', { cacheAsset: false }, second);
    oldComplete(null, new Asset());
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    const result = new Asset();
    newComplete(null, result);
    newComplete(null, result);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(null, result);
});

test('consumer exceptions propagate without becoming another producer completion', () => {
    const factory = new Factory();
    const failure = new Error('consumer failed');
    factory.register('.test', (_id, _data, _options, complete) => complete(null, new Asset()));
    const consumer = jest.fn(() => { throw failure; });
    expect(() => factory.create('factory-consumer', null, '.test', { cacheAsset: false }, consumer)).toThrow(failure);
    expect(consumer).toHaveBeenCalledTimes(1);
    const retry = jest.fn();
    factory.create('factory-consumer', null, '.test', { cacheAsset: false }, retry);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry.mock.calls[0][0]).toBeNull();
});

test('a non-Error producer throw becomes an Error callback', () => {
    const factory = new Factory(), complete = jest.fn();
    factory.register('.test', () => { throw 'font failure'; });
    factory.create('factory-string', null, '.test', {}, complete);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(complete.mock.calls[0][0].message).toBe('font failure');
});

test('a throwing consumer cannot cancel a reentrant request for the same ID', () => {
    const factory = new Factory(), replacement = jest.fn();
    let finishReplacement: any;
    factory.register('.test', (_id, _data, _options, complete) => complete(null, new Asset()));
    expect(() => factory.create('factory-reentrant', null, '.test', { cacheAsset: false }, () => {
        factory.register('.test', (_id, _data, _options, complete) => { finishReplacement = complete; });
        factory.create('factory-reentrant', null, '.test', { cacheAsset: false }, replacement);
        throw new Error('old consumer failed');
    })).toThrow('old consumer failed');
    expect(replacement).not.toHaveBeenCalled();
    const result = new Asset();
    finishReplacement(null, result);
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledWith(null, result);
});
