Option Explicit
Private Sub Workbook_Open()
    BindEntryKeys
End Sub
Private Sub Workbook_Activate()
    BindEntryKeys
End Sub
Private Sub Workbook_Deactivate()
    ReleaseEntryKeys
End Sub
Private Sub Workbook_BeforeClose(Cancel As Boolean)
    ReleaseEntryKeys
End Sub
Private Sub Workbook_AfterSave(ByVal Success As Boolean)
    If Success And ActiveWorkbook Is Me Then BindEntryKeys
End Sub
Private Sub Workbook_SheetSelectionChange(ByVal Sh As Object, ByVal Target As Range)
    EntrySelection Sh, Target
End Sub
Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    EntryChanged Sh, Target
End Sub
