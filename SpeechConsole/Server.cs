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

        //public static MouseEvent ongoingMouse = null;

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

        public class SetInputModeEvent
        {
            public string mode;
        }

        //public class KeyEvent
        //{
        //    public int window;
        //    public bool down;
        //    public string key;
        //    public List<string> modifiers;
        //}

        //public class MouseEvent
        //{
        //    public int window;
        //    public bool down;
        //    public int row;
        //    public int column;
        //    public int button;
        //}

        //public class MouseMoveEvent
        //{
        //    public int window;
        //    public int row;
        //    public int column;
        //    public List<int> buttons;
        //}

        //public class ScrollEvent
        //{
        //    public int window;
        //    public double x;
        //    public double y;
        //}


        //public static object onKey(string json) {
        //    try {
        //        var e = JsonConvert.DeserializeObject<KeyEvent>(json);
        //        Console.WriteLine("Key " + e.key + ", down " + e.down);

        //        if (e.down) {
        //            mainWindow.Invoke((Action)delegate () {
        //                mainWindow.appendKey(e.window, e.key, e.modifiers);
        //            });
        //        }

        //        return new Result(true);
        //    } catch (Exception e) {
        //        return new ErrorResult("could not parse body of key event");
        //    }
        //}

        //public static object onMouse(string json) {
        //    try {
        //        var e = JsonConvert.DeserializeObject<MouseEvent>(json);
        //        Console.WriteLine("Mouse " + e.button + ", down " 
        //            + e.down + ", (" + e.row + ", " + e.column + ")");

        //        if (e.down) {
        //            if (ongoingMouse == null) {
        //                ongoingMouse = e;
        //            } else {
        //                // we just pressed two buttons simultaneously.
        //                // ignore this press
        //            }
        //        }
        //        else {
        //            if (ongoingMouse != null
        //                && e.button == ongoingMouse.button
        //                && e.window == ongoingMouse.window
        //                && (e.row != ongoingMouse.row || e.column != ongoingMouse.column)) 
        //            {
        //                mainWindow.Invoke((Action)delegate () {
        //                    mainWindow.appendDrag(e.window, e.button,
        //                        ongoingMouse.row, ongoingMouse.column, e.row, e.column, true);
        //                });
        //            }
        //            // only process mouse click for earliest button pressed if multiple
        //            // buttons are pressed at the same time
        //            else if (ongoingMouse.button == e.button) {
        //                mainWindow.Invoke((Action)delegate () {
        //                    mainWindow.appendMouse(e.window, e.button, e.down, e.row, e.column);
        //                });
        //            }

        //            ongoingMouse = null;
        //        }

        //        return new Result(true);
        //    }
        //    catch (Exception e) {
        //        return new ErrorResult("could not parse body of mouse event");
        //    }
        //}

        //public static object onMouseMove(string json) {
        //    try {
        //        var e = JsonConvert.DeserializeObject<MouseMoveEvent>(json);

        //        // Ongoing drag
        //        if (e.buttons.Count == 1 && ongoingMouse != null && e.buttons[0] == ongoingMouse.button) {
        //            mainWindow.Invoke((Action)delegate () {
        //                mainWindow.appendDrag(e.window, e.buttons[0],
        //                    ongoingMouse.row, ongoingMouse.column, e.row, e.column, false);
        //            });
        //        }

        //        return new Result(true);
        //    }
        //    catch (Exception e) {
        //        return new ErrorResult("could not parse body of mouse event");
        //    }
        //}

        //public static object onScroll(string json) {
        //    try {
        //        var e = JsonConvert.DeserializeObject<ScrollEvent>(json);
        //        Console.WriteLine("Scroll (" + e.x + ", " + e.y + ")");

        //        mainWindow.Invoke((Action)delegate () {
        //            mainWindow.appendScroll(e.window, e.x, e.y);
        //        });

        //        return new Result(true);
        //    }
        //    catch (Exception e) {
        //        return new ErrorResult("could not parse body of scroll event");
        //    }
        //}

        //public static object onActivate(string json) {
        //    try {
        //        var e = JsonConvert.DeserializeObject<ScrollEvent>(json);
        //        Console.WriteLine("Activate ()");

        //        mainWindow.Invoke((Action)delegate () {
        //            mainWindow.appendActivate(e.window);
        //        });

        //        return new Result(true);
        //    }
        //    catch (Exception e) {
        //        return new ErrorResult("could not parse body of activate event");
        //    }
        //}

        //public static object onRequestCommit(string json) {
        //    Console.WriteLine("RequestCommit ()");

        //    mainWindow.Invoke((Action)delegate () {
        //        mainWindow.commitRequested();
        //    });

        //    return new Result(true);
        //}

        public static object onFocus(string json) {
            Console.WriteLine("Focus ()");

            mainWindow.Invoke((Action)delegate () {
                mainWindow.focusRequested();
            });

            return new Result(true);
        }

        public static object onSetInputMode(string json) {
            var e = JsonConvert.DeserializeObject<SetInputModeEvent>(json);
            mainWindow.Invoke((Action)delegate () {
                mainWindow.setInputMode(e.mode);
            });

            return new Result(true);
        }

        public static object onPerformCommit() {
            mainWindow.Invoke((Action)delegate () {
                mainWindow.clearText(false);
            });

            return new Result(true);
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
                //case "/key":
                //    resp = onKey(body);
                //    break;

                //case "/mouse":
                //    resp = onMouse(body);
                //    break;

                //case "/mouseMove":
                //    resp = onMouseMove(body);
                //    break;

                //case "/scroll":
                //    resp = onScroll(body);
                //    break;

                //case "/activate":
                //    resp = onActivate(body);
                //    break;

                case "/setInputMode":
                    resp = onSetInputMode(body);
                    break;

                //case "/requestCommit":
                //    resp = onRequestCommit(body);
                //    break;

                case "/focus":
                    resp = onFocus(body);
                    break;

                case "/performCommit":
                    resp = onPerformCommit();
                    break;

                default:
                    resp = new ErrorResult("unknown route");
                    break;
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
            listener.Prefixes.Add("http://localhost:6001/");
            listener.Start();

            Console.WriteLine("Listening on 6001...");

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
