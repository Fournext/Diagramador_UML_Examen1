const wsPort = 8000;
const portJava = 7000;
export const environment = {
    production: false,
    wsPort,                // 👈 puerto configurable
    wsPath: '/ws/canvas/',        // 👈 path base
    endpoint_python: `http://127.0.0.1:${wsPort}/`,
    endpoint_java: `http://127.0.0.1:${portJava}/`
};
