const anchor = require("@coral-xyz/anchor");

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
  console.log("GhostVest 部署完成，cluster:", provider.connection.rpcEndpoint);
};
