/**
 * Example QuayPanel plugin (prebuilt CommonJS for drop-in loading).
 * Authors normally compile TypeScript to dist/index.js.
 */
function register(api) {
  api.on("order.paid", (payload) => {
    console.log("[example-logger] order.paid", payload);
  });
  api.on("invoice.created", (payload) => {
    console.log("[example-logger] invoice.created", payload);
  });
  api.on("client.register", (payload) => {
    console.log("[example-logger] client.register", payload);
  });
  api.on("service.provision", (payload) => {
    console.log("[example-logger] service.provision", payload);
  });
}

module.exports = { register };
