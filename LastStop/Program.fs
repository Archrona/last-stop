
open System
open System.Windows.Forms
open System.Drawing

type HelloWindow() =
     let frm = new Form(Width = 400, Height = 140)
     let fnt = new Font("Times New Roman", 28.0f)
     let lbl = new Label(Dock = DockStyle.Fill, Font = fnt,
                           TextAlign = ContentAlignment.MiddleCenter)
     do frm.Controls.Add(lbl)
        let msg = "Hello, World!"
        lbl.Text <- msg

     member x.Run() =
        Application.Run(frm)


[<EntryPoint>]
let main argv =
    Application.EnableVisualStyles ()
    Application.SetCompatibleTextRenderingDefault (false)
    let hw = new HelloWindow ()
    hw.Run ()
    0
