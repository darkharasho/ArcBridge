!macro customInit
  ; Silently uninstall old ArcBridge if present.
  ; electron-builder oneClick NSIS installs to $LOCALAPPDATA\Programs\<name>
  ; with an uninstaller named "Uninstall <productName>.exe".
  StrCpy $0 "$LOCALAPPDATA\Programs\arcbridge\Uninstall ArcBridge.exe"
  ${If} ${FileExists} $0
    ExecWait '"$0" /S _?=$LOCALAPPDATA\Programs\arcbridge'
    ; Clean up the install directory if it still exists
    RMDir /r "$LOCALAPPDATA\Programs\arcbridge"
  ${EndIf}
!macroend
