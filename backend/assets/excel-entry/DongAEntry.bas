Option Explicit
Private busy As Boolean

Public Function Config(ByVal key As String) As Variant
    Config = Application.Evaluate(ThisWorkbook.Names(key).RefersTo)
End Function

Public Sub BindEntryKeys()
    Application.OnKey "~", "'" & Replace(ThisWorkbook.Name, "'", "''") & "'!EntryEnter"
    Application.OnKey "{ENTER}", "'" & Replace(ThisWorkbook.Name, "'", "''") & "'!EntryEnter"
End Sub

' One small vector calendar button follows the entry row; no ActiveX/add-in required.
Public Sub MoveCalendarButton(ByVal row As Long)
    Dim sh As Worksheet, cell As Range, button As Shape, part As Shape
    Dim names As Variant, i As Long, x As Double, y As Double, dx As Double, dy As Double
    Set sh = ThisWorkbook.Worksheets(1)
    names = Array("DongADateButton", "DAcalBody", "DAcalRing1", "DAcalRing2", "DAcalRule")
    If row < 12 Or row > 1011 Then row = 12
    Set cell = sh.Cells(row, 7)
    On Error Resume Next
    Set button = sh.Shapes("DongADateButton")
    On Error GoTo 0
    If button Is Nothing Then
        x = cell.Left + cell.Width - 21
        y = cell.Top + 1
        Set part = sh.Shapes.AddShape(5, x, y, 19, 18)
        part.Name = names(0)
        part.Fill.ForeColor.RGB = RGB(255, 253, 247)
        part.Line.Visible = 0
        Set part = sh.Shapes.AddShape(1, x + 4, y + 5, 11, 10)
        part.Name = names(1)
        part.Fill.Visible = 0
        part.Line.ForeColor.RGB = RGB(32, 55, 45)
        Set part = sh.Shapes.AddLine(x + 6, y + 2, x + 6, y + 6)
        part.Name = names(2)
        Set part = sh.Shapes.AddLine(x + 12, y + 2, x + 12, y + 6)
        part.Name = names(3)
        Set part = sh.Shapes.AddLine(x + 4, y + 8, x + 15, y + 8)
        part.Name = names(4)
        For i = 2 To 4
            sh.Shapes(CStr(names(i))).Line.ForeColor.RGB = RGB(32, 55, 45)
            sh.Shapes(CStr(names(i))).Line.Weight = 1.25
        Next i
        Set button = sh.Shapes(CStr(names(0)))
    End If
    dx = cell.Left + cell.Width - 21 - button.Left
    dy = cell.Top + (cell.Height - button.Height) / 2 - button.Top
    For i = 0 To 4
        Set part = sh.Shapes(CStr(names(i)))
        part.Placement = 1
        part.Left = part.Left + dx
        part.Top = part.Top + dy
        part.OnAction = "OpenBirthdayCalendar"
    Next i
    button.AlternativeText = "Chon ngay sinh - dong " & CStr(row)
    button.Title = CStr(row)
    button.OnAction = "OpenBirthdayCalendar"
End Sub

Public Sub OpenBirthdayCalendar()
    If Not ActiveWorkbook Is ThisWorkbook Then Exit Sub
    Dim row As Long, target As Range
    row = CLng(ThisWorkbook.Worksheets(1).Shapes("DongADateButton").Title)
    Set target = ThisWorkbook.Worksheets(1).Cells(row, 7)
    target.Select
    DongACalendar.OpenFor target
End Sub

Public Sub ReleaseEntryKeys()
    Application.OnKey "~"
    Application.OnKey "{ENTER}"
    On Error Resume Next
    Unload DongACalendar
End Sub

Public Sub EntrySelection(ByVal sh As Object, ByVal target As Range)
    If busy Or sh.Index <> 1 Or target.CountLarge <> 1 Then Exit Sub
    If target.Row >= 12 And target.Row <= 1011 Then MoveCalendarButton target.Row
    If target.Row >= 12 And target.Row <= 1011 And target.Column = 7 Then
        DongACalendar.OpenFor target
    Else
        On Error Resume Next
        DongACalendar.Hide
    End If
End Sub

Public Sub EntryChanged(ByVal sh As Object, ByVal target As Range)
    If busy Or sh.Index <> 1 Then Exit Sub
    Dim edited As Range, cell As Range
    Set edited = Intersect(target, sh.Range("C12:G1011"))
    If edited Is Nothing Then Exit Sub
    On Error GoTo Finish
    busy = True
    Application.EnableEvents = False
    For Each cell In edited.Cells
        sh.Cells(cell.Row, 1).ClearContents
        sh.Cells(cell.Row, 2).ClearContents
    Next cell
    RenumberEntries
Finish:
    Application.EnableEvents = True
    busy = False
End Sub

Private Function ValidRow(ByVal row As Long, Optional ByVal explain As Boolean = False) As Boolean
    Dim sh As Worksheet, problem As String
    Set sh = ThisWorkbook.Worksheets(1)
    If Len(Trim(CStr(sh.Cells(row, 3).Value))) < 2 Then
        problem = "Nhap ho va ten."
    ElseIf Not IsDate(sh.Cells(row, 7).Value) Then
        problem = "Chon ngay sinh tren lich."
    ElseIf CDate(sh.Cells(row, 7).Value) < DateSerial(CLng(Config("DongAMinYear")), 1, 1) Or CDate(sh.Cells(row, 7).Value) > Date Then
        problem = "Ngay sinh khong hop le."
    ElseIf CBool(Config("DongARequireEmail")) And Len(Trim(CStr(sh.Cells(row, 6).Value))) = 0 Then
        problem = "Nhap email giao vien."
    ElseIf Len(Trim(CStr(sh.Cells(row, 6).Value))) > 0 And Not CStr(sh.Cells(row, 6).Value) Like "*@*.*" Then
        problem = "Email khong hop le."
    End If
    ValidRow = Len(problem) = 0
    If Not ValidRow And explain Then MsgBox problem, vbExclamation, "Dong A edu"
End Function

Public Function ConfirmEntry(ByVal row As Long) As Boolean
    If row < 12 Or row > 1011 Or Not ValidRow(row, True) Then Exit Function
    On Error GoTo Finish
    busy = True
    Application.EnableEvents = False
    ThisWorkbook.Worksheets(1).Cells(row, 1).Value = 1
    RenumberEntries
    ConfirmEntry = True
Finish:
    Application.EnableEvents = True
    busy = False
End Function

Public Sub RenumberEntries()
    Dim sh As Worksheet, row As Long, n As Long, serial As Long
    Set sh = ThisWorkbook.Worksheets(1)
    For row = 12 To 1011
        If Len(CStr(sh.Cells(row, 1).Value)) > 0 And ValidRow(row) Then
            n = n + 1
            serial = CLng(Config("DongAOffset")) + n
            sh.Cells(row, 1).Value = n
            sh.Cells(row, 2).NumberFormat = "@"
            sh.Cells(row, 2).Value = CStr(Config("DongAPrefix")) & Format(CDate(sh.Cells(row, 7).Value), "ddmmyyyy") & Format(serial, "000")
        Else
            sh.Cells(row, 1).ClearContents
            sh.Cells(row, 2).ClearContents
        End If
    Next row
End Sub

Public Sub EntryEnter()
    If Not ActiveWorkbook Is ThisWorkbook Then Exit Sub
    If ActiveSheet.Index <> 1 Or ActiveCell.Row < 12 Or ActiveCell.Row > 1011 Or ActiveCell.Column < 3 Or ActiveCell.Column > 7 Then
        ActiveCell.Offset(1, 0).Select
        Exit Sub
    End If
    If ActiveCell.Column < 7 Then
        ActiveCell.Offset(0, 1).Select
    ElseIf ConfirmEntry(ActiveCell.Row) Then
        On Error Resume Next
        DongACalendar.Hide
        If ActiveCell.Row < 1011 Then ActiveSheet.Cells(ActiveCell.Row + 1, 3).Select
    End If
End Sub

Public Function CalendarProbe() As String
    Load DongACalendar
    DongACalendar.Prepare ThisWorkbook.Worksheets(1).Range("G12")
    CalendarProbe = DongACalendar.Caption & "|" & DongACalendar.Controls.Count
    Unload DongACalendar
End Function

Public Sub SetBirthday(ByVal row As Long, ByVal yyyy As Long, ByVal mm As Long, ByVal dd As Long)
    If row < 12 Or row > 1011 Then Exit Sub
    Load DongACalendar
    DongACalendar.Prepare ThisWorkbook.Worksheets(1).Cells(row, 7)
    DongACalendar.PickDate DateSerial(yyyy, mm, dd)
End Sub
