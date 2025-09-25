{
  "targets": [
    {
      "target_name": "xinput_native",
      "sources": [ "src/xinput_native.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "defines": ["_WIN32"],
          "sources": []
        }]
      ]
    }
  ]
}
