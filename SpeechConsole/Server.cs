using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace SpeechConsole
{
    static class Server
    {
        public static HttpListener listener;
        public static Window mainWindow;
        public static bool finalText;

        public class SimpleResult
        {
            public bool success;

            public SimpleResult(bool success) {
                this.success = success;
            }
        }

        public static SimpleResult serveClear() {
            mainWindow.Invoke((Action)delegate () {
                mainWindow.clearText();
            });

            return new SimpleResult(true);
        }

        public static bool serveOneRequest() {
            HttpListenerContext context = listener.GetContext();
            HttpListenerRequest request = context.Request;

            List<string[]> query = new List<string[]>();
            if (request.Url.Query.Length > 1) {
                query = request.Url.Query
                    .Substring(1)
                    .Split('&')
                    .Select(x => x.Split('='))
                    .ToList<string[]>();
            }

            string path = request.Url.AbsolutePath.Substring(1);

            HttpListenerResponse response = context.Response;

            object resp = "unknown route";



            if (path == "clear") {
                resp = serveClear();
            }

            byte[] buffer = System.Text.Encoding.UTF8.GetBytes(
                JsonConvert.SerializeObject(resp)
            );

            response.ContentLength64 = buffer.Length;
            response.ContentType = "application/json";
            System.IO.Stream output = response.OutputStream;
            output.Write(buffer, 0, buffer.Length);
            output.Close();

            return true;
        }

        public static void CreateServer() {
            finalText = false;

            listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:5001/");
            listener.Start();

            Console.WriteLine("Listening on 5001...");

            Task.Factory.StartNew(() => {
                while (serveOneRequest()) {
                    // continue
                }
            }).ContinueWith((result) => {
                listener.Stop();
            });

        }
    }
}
