module.exports = [
  {
    test: /native_modules[\\/].+\.node$/,
    use: 'node-loader',
  },
  {
    test: /[\\/]node_modules[\\/].+\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
  {
    test: /\.(png|jpe?g|gif|svg|ico)$/i,
    type: 'asset/resource',
  },
  {
    test: /\.(mp4|webm|ogg)$/i,
    type: 'asset/resource',
  },
  {
    test: /\.(wav|mp3|m4a|aac|flac)$/i,
    type: 'asset/resource',
  },
];
