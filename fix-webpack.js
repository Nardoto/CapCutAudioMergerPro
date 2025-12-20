const fs = require('fs');
const content = `module.exports = [
  {
    test: /native_modules[\\\\/].+\\.node$/,
    use: 'node-loader',
  },
  {
    test: /[\\\\/]node_modules[\\\\/].+\\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\\.tsx?$/,
    exclude: /node_modules/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
];
`;
fs.writeFileSync('webpack.rules.js', content);
console.log('Fixed!');
