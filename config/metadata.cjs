const {
  author,
  dependencies,
  repository,
  version,
} = require("../package.json");

module.exports = {
  name: {
    "": "Inservice Assistant Automation",
    cn: "Inservice 自动化助手",
    en: "Inservice Assistant Automation",
  },
  namespace: "https://github.com/KurosakiRei/inservice-assistant",
  version: version,
  author: author,
  source: repository.url,
  // 'license': 'MIT',
  match: ["*://*.reach360.com/*"],
  require: [
  ],
  grant: ["GM_addStyle", "GM_setValue", "GM_getValue"],
  connect: [],
  "run-at": "document-end",
  updateURL:
    "https://raw.githubusercontent.com/KurosakiRei/AHC-Inservice-Assistant/dist/index.prod.user.js",
  downloadURL:
    "https://raw.githubusercontent.com/KurosakiRei/AHC-Inservice-Assistant/dist/index.prod.user.js",
};
