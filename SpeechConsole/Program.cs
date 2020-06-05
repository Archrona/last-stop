using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;



namespace SpeechConsole
{
    static class Program
    {
        private static readonly HttpClient client = new HttpClient();

        public static void transfer() {
            onSpeech(Server.mainWindow.getText());
        }


        public static string ESCAPE_START = "▸";
        public static string ESCAPE_END = "◂";
        public static string ESCAPE_SPLIT = "‖";
        public static string ESCAPE_SUBSPLIT = "′";
        public static string ESCAPE_KEY = "κ";
        public static string ESCAPE_MOUSE = "μ";
        public static string ESCAPE_SCROLL = "σ";
        public static string ESCAPE_DRAG = "δ";

        private class Command
        {
            public string command;

            public Command(string command) {
                this.command = command;
            }
        }

        private class SpeechMessage: Command 
        {
            public string text;

            public SpeechMessage(string text): base("speech") {
                this.text = text;
            }
        }
        
        public static void sendMessage(object obj, Action<Task> callback) {
            string json = JsonConvert.SerializeObject(obj);

            Task task = Task.Run(async () => {
                StringContent content = new StringContent(json, Encoding.UTF8, "application/json");
                HttpResponseMessage m = await client.PostAsync("http://127.0.0.1:5000/", content);
                Console.WriteLine("Status: " + m.StatusCode + ", Reason: " + m.ReasonPhrase);
            }).ContinueWith(callback);
        }

        public static void onSpeech(string text) {
            sendMessage(new SpeechMessage(text), (Task t) => {
                Console.WriteLine("onSpeech: faulted = " + t.IsFaulted);
            });
        }

        public static void onCopyAndErase() {
            sendMessage(new Command("copyAndErase"), (Task t) => {
                Console.WriteLine("copyAndErase: faulted = " + t.IsFaulted);
                if (!t.IsFaulted) {
                    Server.mainWindow.Invoke((Action)delegate () {
                        Server.mainWindow.clearText();
                    });
                }
            });
        }

        public static void onCommitChanges() {
            sendMessage(new Command("commitChanges"), (Task t) => {
                Console.WriteLine("commitChanges: faulted = " + t.IsFaulted);
                if (!t.IsFaulted) {
                    Server.mainWindow.Invoke((Action)delegate () {
                        Server.mainWindow.clearText();
                    });
                }
            });
        }

        public static void onReloadData() {
            sendMessage(new Command("reloadData"), (Task t) => {
                Console.WriteLine("reloadData: faulted = " + t.IsFaulted);
            });
        }

        [STAThread]
        static void Main() {
            client.Timeout = new TimeSpan(0, 0, 0, 0, 250); // 250 ms

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Server.mainWindow = new Window();
            Server.CreateServer();
            Application.Run(Server.mainWindow);

        }

        
    }
}
