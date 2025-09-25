const wsPort = 8000;
const portJava = 7000;
export const environment = {
    production: false,
    wsPort,                
    wsPath: '/ws/canvas/',        
    //endpoint_python: `http://127.0.0.1:${wsPort}/`,
    endpoint_python: `http://ec2-3-84-241-46.compute-1.amazonaws.com:${wsPort}/`,
    //endpoint_java: `http://127.0.0.1:${portJava}/`
    endpoint_java: `http://ec2-3-84-241-46.compute-1.amazonaws.com:${portJava}/`
};