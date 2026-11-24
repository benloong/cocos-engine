// Exercise the Native JSB task and its real completion queue before HEAD completes.
module.exports = async function checkLocalDownloadAbort() {
    const {Downloader, fileUtils} = globalThis.jsb;
    const folder = fileUtils.getWritablePath();
    const source = folder + '/font-source.ttf';
    const dest = folder + '/font-replacement.ttf';
    const temp = dest + '.tmp';
    const old = 'previous destination';
    const prefix = 'previous staging prefix';
    if (!fileUtils.writeStringToFile('local transfer fixture', source)
        || !fileUtils.writeStringToFile(old, dest)) throw new Error('Could not seed local transfer');
    const url = 'file:///' + source.replace(/\\/g, '/');
    const loader = new Downloader({countOfMaxProcessingTasks: 1, tempFileNameSuffix: '.tmp'});
    let callbacks = 0;
    // Retain each previous task while reclaiming the same destination.
    const tasks = [];
    for (let cycle = 0; cycle < 32; cycle++) {
        const hasPrefix = cycle % 2 === 1;
        if (hasPrefix && !fileUtils.writeStringToFile(prefix, temp)) throw new Error('Could not seed staging prefix');
        await new Promise((resolve, reject) => {
            const id = String(cycle);
            loader.onSuccess = () => reject(new Error('Cancelled task succeeded'));
            loader.onError = (failed, code) => {
                callbacks++;
                if (failed.identifier !== id || code !== -4) reject(new Error('Unexpected completion: ' + failed.identifier + '/' + code));
                else resolve();
            };
            const task = loader.createDownloadTask(url, dest, id);
            tasks.push(task);
            loader.abort(task);
        });
        if (fileUtils.getStringFromFile(dest) !== old || fileUtils.isFileExist(temp) !== hasPrefix
            || (hasPrefix && fileUtils.getStringFromFile(temp) !== prefix)) throw new Error('Cancellation changed destination or staging state');
        if (hasPrefix && !fileUtils.removeFile(temp)) throw new Error('Could not release staging file');
    }
    if (callbacks !== tasks.length || !fileUtils.removeFile(dest) || !fileUtils.removeFile(source)) {
        throw new Error('Local cancellation cleanup failed');
    }
    return {callbacks, destinationReuses: tasks.length - 1, preservedPrefixes: 16};
};
