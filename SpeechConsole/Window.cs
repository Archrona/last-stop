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

        public string getText() {
            return input.Text;
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
        }

        private void input_TextChanged(object sender, EventArgs e) {
            if (disableInputUpdates) {
                Console.WriteLine("Output suppressed...");
                return;
            }

            if (sendImmediateUpdate) {
                Program.onSpeech(input.Text);
                sendImmediateUpdate = false;
                textChanged = false;
            } else {
                textChanged = true;
            }
            
            ticksSinceChanged = 0;
        }

        private void Window_Load(object sender, EventArgs e) {

        }

        private void Window_KeyDown(object sender, KeyEventArgs e) {
            // if (e.KeyCode == Keys.C && e.Control && e.Shift) {
            //     Program.onCopyAndErase();
            // }

            if (e.KeyCode == Keys.S && e.Control) {
                //Program.onCommitChanges();
                commitRequested();
            }
           
            if (e.KeyCode == Keys.D0 && e.Control) {
                Program.onReloadData();
            }
        }

        private void textChangeMonitor_Tick(object sender, EventArgs e) {
            if (textChanged) {
                ticksSinceChanged++;
                if (ticksSinceChanged >= 2) {
                    Program.onSpeech(input.Text);
                    textChanged = false;
                    ticksSinceChanged = 0;
                }
            } else {
                ticksSinceChanged = 0;
            }
            
        }

        public void appendSpecial(string type, int window, string special) {
            sendImmediateUpdate = true;

            var text = input.Text;

            int i = text.Length - 1;
            int first = 0, last = 0;

            while (i > 0) {
                if (text[i] == ' ') {
                    i--;
                } else if (text[i] == Program.ESCAPE_END[0]) {
                    last = i;
                    first = last - 1;

                    while (first >= 0 && text[first] != Program.ESCAPE_START[0])
                        first--;

                    if (first < 0)
                        break;

                    string body = text.Substring(first + 1, last - first - 1);
                    if (body[0] != type[0])
                        break;

                    int prime = body.IndexOf(Program.ESCAPE_SUBSPLIT[0], 0);
                    string win = body.Substring(1, prime - 1);
                    int winInt = int.Parse(win);
                    if (winInt != window)
                        break;

                    if (type == Program.ESCAPE_SCROLL) {
                        string[] parts = body.Split(Program.ESCAPE_SUBSPLIT[0]);
                        string[] next = special.Split(Program.ESCAPE_SUBSPLIT[0]);
                        int x = int.Parse(parts[1]) + int.Parse(next[0]);
                        int y = int.Parse(parts[2]) + int.Parse(next[1]);

                        input.Text = text.Substring(0, first + 1) +
                            parts[0] + Program.ESCAPE_SUBSPLIT +
                            x + Program.ESCAPE_SUBSPLIT +
                            y + Program.ESCAPE_END;
                    }
                    else {
                        input.Text = text.Substring(0, last)
                            + Program.ESCAPE_SUBSPLIT + special + Program.ESCAPE_END;
                    }

                    input.SelectionStart = input.Text.Length;
                    input.SelectionLength = 0;
                    return;
                } else {
                    break;
                }
            }

            appendNewSpecial(type, window, special);
        }

        public void appendNewSpecial(string type, int window, string special = "") {
            if (input.Text.Length > 0 && input.Text[input.Text.Length - 1] != ' ') {
                input.Text += " ";
            }

            input.Text += Program.ESCAPE_START + type + window +
                (special.Length == 0 ? "" : Program.ESCAPE_SUBSPLIT + special) + 
                Program.ESCAPE_END;

            input.SelectionStart = input.Text.Length;
            input.SelectionLength = 0;
        }

        

        public void appendKey(int window, string k, List<string> modifiers) {
            if (modifiers.Contains("meta")) k = "W-" + k; 
            if (modifiers.Contains("alt")) k = "M-" + k;
            if (modifiers.Contains("control")) k = "C-" + k;

            appendSpecial(Program.ESCAPE_KEY, window, k);
        }

        public void appendMouse(int window, int button, bool down, int row, int column) {
            appendSpecial(Program.ESCAPE_MOUSE, window,
                button
                + Program.ESCAPE_SUBSPLIT + row
                + Program.ESCAPE_SUBSPLIT + column
            );
        }

        public void appendScroll(int window, double x, double y) {
            appendSpecial(Program.ESCAPE_SCROLL, window,
                ((int)(x / 2.0))
                + Program.ESCAPE_SUBSPLIT + ((int)(y / 2.0))
            );
        }

        public void appendDrag(int window, int button, int row1, int column1, int row2, int column2) {
            appendSpecial(Program.ESCAPE_DRAG, window,
                button
                + Program.ESCAPE_SUBSPLIT + row1
                + Program.ESCAPE_SUBSPLIT + column1
                + Program.ESCAPE_SUBSPLIT + row2
                + Program.ESCAPE_SUBSPLIT + column2
            );
        }

        public void appendActivate(int window) {
            appendNewSpecial(Program.ESCAPE_ACTIVATE, window);
        }

        public void commitRequested() {
            string text = input.Text;
            text += " " + Program.ESCAPE_START + Program.ESCAPE_COMMIT + "0" + Program.ESCAPE_END;

            disableInputUpdates = true;
            Program.sendMessage(new Program.SpeechMessage(text), (Task t) => {
                Console.WriteLine("onSpeech: faulted = " + t.IsFaulted);
                disableInputUpdates = false;
            });

            input.Text = "";
        }
    }
}
