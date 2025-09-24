const wsPort = 8000;
const portJava = 7000;
export const environment = {
    production: false,
    wsPort,                // 👈 puerto configurable
    wsPath: '/ws/canvas/',        // 👈 path base
    //endpoint_python: `http://127.0.0.1:${wsPort}/`,
    //endpoint_python: `https://ec2-34-228-19-253.compute-1.amazonaws.com:${wsPort}/`,
    endpoint_python: `https://sw1.fournext.me/django/`,
    //endpoint_java: `http://127.0.0.1:${portJava}/`
    //endpoint_java: `https://ec2-34-228-19-253.compute-1.amazonaws.com:${portJava}/`
    endpoint_java: `https://sw1.fournext.me/spring_boot/`
};
