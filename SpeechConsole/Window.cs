using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;


namespace SpeechConsole
{
    public partial class Window : Form
    {
        [DllImport("user32.dll")]
        internal static extern IntPtr SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        private bool textChanged;
        private int ticksSinceChanged;
        private bool sendImmediateUpdate;
        private bool disableInputUpdates;
        private string inputMode; // "raw" or "speech"

        public string getText() {
            return input.Text;
        }

        public void focusRequested() {
            Process currentProcess = Process.GetCurrentProcess();
            IntPtr hWnd = currentProcess.MainWindowHandle;
            if (hWnd != IntPtr.Zero) {
                SetForegroundWindow(hWnd);
                //ShowWindow(hWnd, User32.SW_MAXIMIZE);
            }

            input.Focus();
        }

        public void clearText(bool focusSelf = true) {
            input.Text = "";

            if (focusSelf) {
                Process currentProcess = Process.GetCurrentProcess();
                IntPtr hWnd = currentProcess.MainWindowHandle;
                if (hWnd != IntPtr.Zero) {
                    SetForegroundWindow(hWnd);
                    //ShowWindow(hWnd, User32.SW_MAXIMIZE);
                }

                input.Focus();
            }
        }

        public void setLanguageInfo(string info) {
            this.Text = "Last Stop Speech Console";
        }

        public Window() {
            InitializeComponent();

            textChanged = false;
            ticksSinceChanged = 0;
            sendImmediateUpdate = false;
            disableInputUpdates = false;

            inputMode = "unknown";
            input.Enabled = false;
            input.BackColor = Color.FromArgb(128, 128, 128);

            Program.sendMessage(new Program.Command("introduce"), (Task t) => {
                Console.WriteLine("introduce: faulted = " + t.IsFaulted);
            });
        }

        private void input_TextChanged(object sender, EventArgs e) {
            if (disableInputUpdates) {
                Console.WriteLine("Output suppressed...");
                return;
            }

            if (sendImmediateUpdate) {
                if (inputMode == "speech") {
                    Program.onSpeech(input.Text);
                }
                sendImmediateUpdate = false;
                textChanged = false;
            }
            else {
                textChanged = true;
            }

            ticksSinceChanged = 0;
        }

        private void Window_Load(object sender, EventArgs e) {

        }

        private void Window_KeyDown(object sender, KeyEventArgs e) {
            if (e.KeyCode == Keys.S && e.Control) {
                //commitRequested();
            }
           
            if (e.KeyCode == Keys.D0 && e.Control) {
                //Program.onReloadData();
            }
        }

        private void textChangeMonitor_Tick(object sender, EventArgs e) {
            if (textChanged) {
                ticksSinceChanged++;
                if (ticksSinceChanged >= 2) {
                    if (inputMode == "speech") {
                        Program.onSpeech(input.Text);
                    }
                    textChanged = false;
                    ticksSinceChanged = 0;
                }
            } else {
                ticksSinceChanged = 0;
            }
        }


        //public void commitRequested() {
        //    string text = input.Text;
        //    text += " " + Program.ESCAPE_START + Program.ESCAPE_COMMIT + "0" + Program.ESCAPE_END;

        //    disableInputUpdates = true;
        //    Program.sendMessage(new Program.SpeechMessage(text), (Task t) => {
        //        Console.WriteLine("onSpeech: faulted = " + t.IsFaulted);
        //        disableInputUpdates = false;
        //    });

        //    input.Text = "";
        //}

        public void setInputMode(string mode) {

            if (mode == "raw" && this.inputMode != "raw") {
                this.input.Text = "";
                this.input.Enabled = false;
                this.input.BackColor = Color.FromArgb(50, 50, 50);
                this.inputMode = "raw";
            } 
            else if (mode == "speech" && this.inputMode != "speech") {
                this.input.Text = "";
                this.input.Enabled = true;
                this.input.BackColor = Color.FromArgb(24, 24, 24);
                this.inputMode = "speech";

                input.Focus();
            }
        }

        private void input_MouseUp(object sender, MouseEventArgs e) {
            
        }

        private void Window_MouseClick(object sender, MouseEventArgs e) {
            if (inputMode == "raw") {
                Program.sendMessage(new Program.Command("requestSpeechMode"), (Task t) => {
                    Console.WriteLine("requestSpeechMode: faulted = " + t.IsFaulted);
                });


            }
        }

        private void input_KeyPress(object sender, KeyPressEventArgs e) {

        }
    }
}
