module.exports = async function checkGraphicsBackendAccess(cc, parent, target, checkClearRedraw) {
    const prototype = cc.Graphics.prototype;
    const fields = ['model', 'graphicsNativeProxy'];
    const installed = [];
    const accesses = [];
    try {
        for (const name of fields) {
            if (name in prototype) throw new Error('Review newly exposed Graphics field ' + name);
            const record = operation => {
                accesses.push(operation + ' ' + name);
                throw new Error('Unexpected Graphics backend access: ' + operation + ' ' + name);
            };
            Object.defineProperty(prototype, name, {
                configurable: true,
                get() { record('read'); },
                set() { record('write'); },
            });
            installed.push(name);
        }
        const { cycles } = await checkClearRedraw(cc, parent, target);
        if (accesses.length) throw new Error(accesses.join(', '));
        return { cycles, guardedFields: fields, accesses };
    } finally {
        for (const name of installed) delete prototype[name];
    }
};
