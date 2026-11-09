Option Explicit
Private chosenCell As Range
Private changing As Boolean
Private visibleMonth As Date

Public Sub Prepare(ByVal target As Range)
    Dim y As Long, m As Long, start As Date
    changing = True
    Set chosenCell = target
    If IsDate(target.Value) And Len(CStr(target.Value)) > 0 Then
        start = CDate(target.Value)
    Else
        start = DateSerial(Year(Date) - IIf(CBool(Config("DongARequireEmail")), 30, 13), Month(Date), 1)
    End If
    MonthBox.Clear
    MonthBox.Style = 2
    For m = 1 To 12: MonthBox.AddItem "Thang " & m: Next m
    YearBox.Clear
    YearBox.Style = 2
    For y = CLng(Config("DongAMinYear")) To Year(Date): YearBox.AddItem CStr(y): Next y
    MonthBox.ListIndex = Month(start) - 1
    YearBox.Value = CStr(Year(start))
    Me.BackColor = RGB(255, 253, 247)
    Me.Caption = "Chon ngay sinh"
    changing = False
    DrawMonth
End Sub

Public Sub OpenFor(ByVal target As Range)
    Prepare target
    If Not Me.Visible Then Me.Show vbModeless
End Sub

Private Sub DrawMonth()
    If changing Or MonthBox.ListIndex < 0 Or Not IsNumeric(YearBox.Value) Then Exit Sub
    visibleMonth = DateSerial(CLng(YearBox.Value), MonthBox.ListIndex + 1, 1)
    Dim first As Date, d As Date, i As Long, btn As Object
    first = visibleMonth - (Weekday(visibleMonth, vbMonday) - 1)
    For i = 1 To 42
        d = first + i - 1
        Set btn = Me.Controls("Day" & i)
        btn.Caption = CStr(Day(d))
        btn.Tag = Format(d, "yyyy-mm-dd")
        btn.Enabled = d >= DateSerial(CLng(Config("DongAMinYear")), 1, 1) And d <= Date
        btn.BackColor = IIf(Month(d) = Month(visibleMonth), RGB(255, 253, 247), RGB(239, 234, 222))
        btn.ForeColor = IIf(Month(d) = Month(visibleMonth), RGB(32, 55, 45), RGB(140, 140, 130))
        If IsDate(chosenCell.Value) Then
            If d = CDate(chosenCell.Value) Then btn.BackColor = RGB(230, 190, 113)
        End If
    Next i
End Sub

Private Sub MonthBox_Change()
    DrawMonth
End Sub
Private Sub YearBox_Change()
    DrawMonth
End Sub
Private Sub PreviousButton_Click()
    MoveMonth -1
End Sub
Private Sub NextButton_Click()
    MoveMonth 1
End Sub
Private Sub MoveMonth(ByVal delta As Long)
    Dim d As Date
    d = DateAdd("m", delta, visibleMonth)
    If Year(d) < CLng(Config("DongAMinYear")) Or Year(d) > Year(Date) Then Exit Sub
    changing = True
    MonthBox.ListIndex = Month(d) - 1
    YearBox.Value = CStr(Year(d))
    changing = False
    DrawMonth
End Sub
Public Sub PickDate(ByVal d As Date)
    If chosenCell Is Nothing Then Exit Sub
    If d < DateSerial(CLng(Config("DongAMinYear")), 1, 1) Or d > Date Then Exit Sub
    chosenCell.NumberFormat = "dd/mm/yyyy"
    chosenCell.Value = d
    Me.Hide
    chosenCell.Select
End Sub
Private Sub ChooseDay(ByVal index As Long)
    Dim value As String
    value = Me.Controls("Day" & index).Tag
    PickDate DateSerial(CInt(Left(value, 4)), CInt(Mid(value, 6, 2)), CInt(Right(value, 2)))
End Sub
Private Sub TodayButton_Click()
    PickDate Date
End Sub
Private Sub CloseButton_Click()
    Me.Hide
End Sub
