module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "prettier", "unused-imports"],
  extends: [
    "airbnb",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "react/no-unused-prop-types": 0,
    "linebreak-style": 0,
    "import/prefer-default-export": 0,
    "prettier/prettier": 0,
    "import/extensions": 0,
    "no-use-before-define": 0,
    "import/no-unresolved": 0,
    "import/no-extraneous-dependencies": 0,
    "no-shadow": 0,
    "react/prop-types": 0,
    "react/jsx-filename-extension": [
      2,
      { extensions: [".js", ".jsx", ".ts", ".tsx"] },
    ],
    "jsx-a11y/no-noninteractive-element-interactions": 0,
    "react/react-in-jsx-scope": 0,
    "react/require-default-props": 0,
    "unused-imports/no-unused-imports": 2,
    "no-nested-ternary": 0,
    "react/jsx-no-useless-fragment": 0,
    "react/no-unstable-nested-components": [2, { allowAsProps: true }],
    "react/jsx-props-no-spreading": 0,
    "no-useless-constructor": 0,
    "@typescript-eslint/no-useless-constructor": 2,
    "no-alert": 0,
    camelcase: 0,
    "consistent-return": 0,
    "@typescript-eslint/consistent-type-imports": [
      2,
      { prefer: "type-imports" },
    ],
    "jsx-a11y/media-has-caption": 0,
    "default-case": 0,
    "no-fallthrough": 0,
    "no-underscore-dangle": 0,
    "react/button-has-type": 0,
    "react/function-component-definition": [
      1,
      { namedComponents: "function-declaration" },
    ],
    "jsx-a11y/label-has-associated-control": [
      2,
      {
        labelAttributes: ["htmlFor"],
      },
    ],
    "no-param-reassign": 0,
  },
};
