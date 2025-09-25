#include <napi.h>
#include <windows.h>
// On évite le linkage direct avec xinput.lib pour ne pas dépendre d'une version précise du SDK.
// Chargement dynamique via LoadLibrary/GetProcAddress.
#include <Xinput.h>
#include <thread>
#include <atomic>
#include <vector>
#include <string>

// Minimal watcher that polls XInput for Start + Back held combo.
// Emits JS callback (no args) when fired with cooldown & hold logic.

namespace
{

  class Watcher : public Napi::ObjectWrap<Watcher>
  {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
      Napi::Function ctor = DefineClass(env, "Watcher", {InstanceMethod("start", &Watcher::Start), InstanceMethod("stop", &Watcher::Stop), InstanceAccessor<&Watcher::IsRunning>("running")});
      exports.Set("Watcher", ctor);
      return exports;
    }

    Watcher(const Napi::CallbackInfo &info)
        : Napi::ObjectWrap<Watcher>(info), running_(false), cooldownMs_(2000), holdMs_(200)
    {
      Napi::Env env = info.Env();
      if (info.Length() < 1 || !info[0].IsFunction())
      {
        Napi::TypeError::New(env, "Callback function attendu").ThrowAsJavaScriptException();
        return;
      }
      cb_ = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "xinput-cb", 0, 1);
    }

    ~Watcher() override
    {
      StopInternal();
    }

  private:
    Napi::Value IsRunning(const Napi::CallbackInfo &info)
    {
      return Napi::Boolean::New(info.Env(), running_.load());
    }

    void Start(const Napi::CallbackInfo &info)
    {
      if (running_.load())
        return;
      running_.store(true);
      worker_ = std::thread([this]()
                            { PollLoop(); });
    }

    void Stop(const Napi::CallbackInfo &info)
    {
      StopInternal();
    }

    void StopInternal()
    {
      if (!running_.exchange(false))
        return;
      if (worker_.joinable())
        worker_.join();
      if (cb_)
      {
        cb_.Release();
        cb_ = nullptr;
      }
    }

    void PollLoop()
    {
      using XInputGetState_t = DWORD(WINAPI *)(DWORD, XINPUT_STATE *);
      XInputGetState_t fxInputGetState = nullptr;
      // Tentatives de DLL (ordre du plus récent au plus ancien)
      std::vector<std::wstring> dlls = {L"XInput1_4.dll", L"XInput1_3.dll", L"XInput9_1_0.dll"};
      HMODULE hLib = nullptr;
      for (const auto &d : dlls)
      {
        hLib = LoadLibraryW(d.c_str());
        if (hLib)
        {
          fxInputGetState = reinterpret_cast<XInputGetState_t>(GetProcAddress(hLib, "XInputGetState"));
          if (fxInputGetState)
            break;
          FreeLibrary(hLib);
          hLib = nullptr;
        }
      }
      if (!fxInputGetState)
      {
        // Impossible de charger XInput -> on arrête proprement.
        running_.store(false);
        return;
      }

      const DWORD BUTTON_START = 0x0010;
      const DWORD BUTTON_BACK = 0x0020;
      DWORD holdStart = 0;
      bool comboArmed = false;
      DWORD lastFireTick = 0;

      while (running_.load())
      {
        bool any = false;
        for (DWORD i = 0; i < 4; ++i)
        {
          XINPUT_STATE state;
          ZeroMemory(&state, sizeof(state));
          if (fxInputGetState(i, &state) == ERROR_SUCCESS)
          {
            any = true;
            bool startPressed = (state.Gamepad.wButtons & BUTTON_START) != 0;
            bool backPressed = (state.Gamepad.wButtons & BUTTON_BACK) != 0;
            if (startPressed && backPressed)
            {
              if (!comboArmed)
              {
                comboArmed = true;
                holdStart = GetTickCount();
              }
              if (comboArmed && (GetTickCount() - holdStart) >= holdMs_)
              {
                DWORD now = GetTickCount();
                if (now - lastFireTick >= cooldownMs_)
                {
                  lastFireTick = now;
                  comboArmed = false;
                  if (cb_)
                  {
                    auto status = cb_.BlockingCall([](Napi::Env env, Napi::Function jsCb)
                                                   { jsCb.Call({}); });
                    if (status != napi_ok)
                    {
                      // If callback queue is closing, stop.
                    }
                  }
                }
              }
            }
            else
            {
              comboArmed = false;
            }
          }
        }
        if (!any)
        {
          comboArmed = false;
        }
        Sleep(30);
      }
    }

    std::thread worker_;
    std::atomic<bool> running_;
    Napi::ThreadSafeFunction cb_;
    const DWORD cooldownMs_;
    const DWORD holdMs_;
  };

  Napi::Object InitAll(Napi::Env env, Napi::Object exports)
  {
    return Watcher::Init(env, exports);
  }

} // anonymous namespace

NODE_API_MODULE(xinput_native, InitAll)
