; 将桌面快捷方式显示名与界面中文名称保持一致，安装目录和产品标识仍使用 QuadratLab。
!macro NSIS_HOOK_POSTINSTALL
  ; 首次安装时，默认快捷方式由 Tauri 按 productName 创建。
  ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    Delete "$DESKTOP\样方实验.lnk"
    Rename "$DESKTOP\${PRODUCTNAME}.lnk" "$DESKTOP\样方实验.lnk"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Tauri 默认只会清理 productName 命名的快捷方式，这里补充清理中文名称。
  Delete "$DESKTOP\样方实验.lnk"
!macroend
