// Sem isto, o .sql importado pelo migrations.js gerado pelo drizzle-kit
// é tratado como código JS pelo Metro e falha ao parsear ("Missing semicolon").
// O plugin injeta o conteúdo do arquivo como string literal no bundle.
// https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
