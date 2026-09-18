// Configuração do Metro para monorepo.
//
// Por padrão o Metro só enxerga arquivos dentro da pasta do app — ele não
// resolveria `@kairo/core` vivendo em `packages/core` fora daqui. Isso é o
// padrão documentado pela Expo para monorepos (watchFolders + nodeModulesPaths
// apontando também para a raiz do workspace).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Observa mudanças em arquivos fora de apps/mobile também (packages/*).
config.watchFolders = [workspaceRoot];

// Resolve dependências tanto do node_modules local quanto do da raiz —
// necessário porque com workspaces os pacotes hoisted ficam na raiz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// drizzle-kit (driver: 'expo') gera migrations.js que faz `import m0000 from
// './0000_xxx.sql'` — sem isto o Metro não sabe o que fazer com .sql e tenta
// interpretar o arquivo como JS ("Missing semicolon"). O parse de verdade
// (SQL → string) é feito pelo babel-plugin-inline-import, em babel.config.js —
// isto aqui só ensina o Metro a RESOLVER a extensão.
// https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite
config.resolver.sourceExts.push('sql');

// expo-sqlite no alvo Web carrega o motor via WebAssembly (wa-sqlite.wasm).
// .wasm é binário, não código-fonte — precisa ir em assetExts, não sourceExts,
// senão o Metro nem tenta resolver o arquivo ("Unable to resolve module").
config.resolver.assetExts.push('wasm');

module.exports = config;
