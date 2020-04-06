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
            informText(Server.mainWindow.getText());
        }

        private class TextMessage
        {
            public string text;
        }

        public static void informText(string text) {
            TextMessage tm = new TextMessage();
            tm.text = text;

            string json = JsonConvert.SerializeObject(tm);

            Task task = Task.Run(async () => {
                StringContent content = new StringContent(json, Encoding.UTF8, "application/json");
                HttpResponseMessage m = await client.PostAsync("http://127.0.0.1:5000/", content);
                Console.WriteLine("Status: " + m.StatusCode + ", Reason: " + m.ReasonPhrase);
            }).ContinueWith((Task t) => {
                if (t.IsFaulted) {
                    Console.WriteLine("Update could not be sent.");
                }
                else {
                    Console.WriteLine("Update sent.");
                }
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
