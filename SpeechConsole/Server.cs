using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
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

        public static MouseEvent lastMouse = null;

        public class Result
        {
            public bool success;

            public Result(bool success) {
                this.success = success;
            }
        }

        public class ErrorResult : Result
        {
            public string message;

            public ErrorResult(string message): base(false) {
                this.message = message;
            }
        }

        public class KeyEvent
        {
            public int window;
            public bool down;
            public string key;
            public List<string> modifiers;
        }

        public class MouseEvent
        {
            public int window;
            public bool down;
            public int row;
            public int column;
            public int button;
        }

        public class ScrollEvent
        {
            public int window;
            public double x;
            public double y;
        }

/*
            mainWindow.Invoke((Action)delegate () {
                mainWindow.clearText();
            });
*/

        public static object onKey(string json) {
            try {
                var e = JsonConvert.DeserializeObject<KeyEvent>(json);
                Console.WriteLine("Key " + e.key + ", down " + e.down);

                if (e.down) {
                    mainWindow.Invoke((Action)delegate () {
                        mainWindow.appendKey(e.window, e.key, e.modifiers);
                    });
                }

                return new Result(true);
            } catch (Exception e) {
                return new ErrorResult("could not parse body of key event");
            }
        }

        public static object onMouse(string json) {
            try {
                var e = JsonConvert.DeserializeObject<MouseEvent>(json);
                Console.WriteLine("Mouse " + e.button + ", down " 
                    + e.down + ", (" + e.row + ", " + e.column + ")");

                if (e.down) {
                    lastMouse = e;
                }

                if (!e.down) {
                    if (lastMouse != null
                        && e.button == lastMouse.button
                        && e.window == lastMouse.window
                        && (e.row != lastMouse.row || e.column != lastMouse.column)) 
                    {
                        mainWindow.Invoke((Action)delegate () {
                            mainWindow.appendDrag(e.window, e.button, lastMouse.row, lastMouse.column, e.row, e.column);
                        });
                    }
                    else {
                        mainWindow.Invoke((Action)delegate () {
                            mainWindow.appendMouse(e.window, e.button, e.down, e.row, e.column);
                        });
                    }

                    lastMouse = null;
                }

                // TODO drag

                return new Result(true);
            }
            catch (Exception e) {
                return new ErrorResult("could not parse body of mouse event");
            }
        }

        public static object onScroll(string json) {
            try {
                var e = JsonConvert.DeserializeObject<ScrollEvent>(json);
                Console.WriteLine("Scroll (" + e.x + ", " + e.y + ")");

                mainWindow.Invoke((Action)delegate () {
                    mainWindow.appendScroll(e.window, e.x, e.y);
                });

                return new Result(true);
            }
            catch (Exception e) {
                return new ErrorResult("could not parse body of scroll event");
            }
        }

        public static bool serveOneRequest() {
            HttpListenerContext context = listener.GetContext();
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            Console.WriteLine("serving request:");

            var sr = new StreamReader(request.InputStream, Encoding.UTF8);
            string body = sr.ReadToEnd();
            Console.WriteLine(body);

            string path = request.Url.AbsolutePath;
            Console.WriteLine(path);

            object resp = new ErrorResult("fell through");

            switch (path) {
                case "/key":
                    resp = onKey(body);
                    break;

                case "/mouse":
                    resp = onMouse(body);
                    break;

                case "/scroll":
                    resp = onScroll(body);
                    break;

                default:
                    resp = new ErrorResult("unknown route");
                    break;
            }

/*
            List<string[]> query = new List<string[]>();
            if (request.Url.Query.Length > 1) {
                query = request.Url.Query
                    .Substring(1)
                    .Split('&')
                    .Select(x => x.Split('='))
                    .ToList<string[]>();
            }

            string path = request.Url.AbsolutePath.Substring(1);
*/
            
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
