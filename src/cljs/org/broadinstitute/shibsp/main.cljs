(ns org.broadinstitute.shibsp.main
  (:require
   [cljs.nodejs :as nodejs]
   cljs.pprint
   clojure.string
   ))

(def fs (nodejs/require "fs"))
(def http (nodejs/require "http"))
(def url (nodejs/require "url"))

(def Cookies (nodejs/require "cookies"))
(def jwt (nodejs/require "jsonwebtoken"))


(nodejs/enable-util-print!)


(defn log [& args]
  (let [arr (array)]
    (doseq [x args] (.push arr x))
    (js/console.log.apply js/console arr))
  (last args))


(defn cljslog [& args]
  (apply log (map #(with-out-str (cljs.pprint/pprint %)) args))
  (last args))


(defn jslog [& args]
  (apply log (map clj->js args))
  (last args))


(defn restart-server [req res]
  (let [child-process (nodejs/require "child_process")
        fs (nodejs/require "fs")]
    (println "Restarting server...")
    (.writeHead res 200 (clj->js {"Content-Type" "text/plain"}))
    (.end res "Server restarting...\n")
    (.readFile fs "/etc/service/app/supervise/pid"
               (fn [err data]
                 (when err (throw err))
                 (.spawn child-process "kill" (clj->js [(js/parseInt data)]))))))


(defn- set-cookie-and-redirect [req res]
  (let [parsed-url (.parse url (.-url req) true)
        redirect-url (aget (.-query parsed-url) "redirect-url")
        redirect-url (when redirect-url (clojure.string/trim redirect-url))
        redirect-url (when-not (clojure.string/blank? redirect-url) redirect-url)]
    (if-not redirect-url
      (do
        (.writeHead res 400)
        (.end res "Missing redirect-url parameter."))
      (do
        (.set (Cookies. req res) "redirect-url" redirect-url)
        (.writeHead
         res 303
         (clj->js
          {"Location" "/login-and-redirect"}))
        (.end res)))))


(defn- redirect-with-token [req res]
  (let [nih-username (aget (.-headers req) "x-nih-username")
        nih-username (when nih-username (clojure.string/trim nih-username))
        nih-username (if (clojure.string/blank? nih-username) nil nih-username)
        redirect-url (.get (Cookies. req res) "redirect-url")]
    (if (nil? nih-username)
      (do
        (.writeHead res 400 (clj->js {"Content-Type" "text/plain"}))
        (.end res "Username not provided.\n"))
      (do
        (.writeHead
         res 303
         (clj->js
          {"Location"
           (clojure.string/replace
            redirect-url
            "{token}"
            (.sign jwt nih-username (-> js/process .-env .-SIGNING_SECRET)))}))
        (.end res)))))


(defn- auth-completed-example [req res]
  (.writeHead res 200)
  (.end res "Parse the token in this URL to verify username."))


(defn- send-info-page [req res]
  (.writeHead res 200 (clj->js {"Content-Type" "text/html"}))
  (.end
   res
   (str
    "<html>"
    "<head><title>Shibboleth Authentication Service</title></head>"
    "<body>"
    "<p>To authenticate, visit:</p>"
    "<a href=\"/link-nih-account?redirect-url="
    (js/encodeURIComponent (str "https://" (-> js/process .-env .-SERVER_NAME)
                                "/auth-completed-example?token={token}"))
    "\">/link-nih-account</a>"
    "</body>"
    "</html>"
    "\n")))


(defn- handle-request [req res]
  (let [url (.-url req)]
    (cond
      (= url "/") (send-info-page req res)
      (and (= (-> js/process .-env .-DEV) "true") (= url "/restart"))
      (restart-server req res)
      (re-find #"^/link-nih-account" url) (set-cookie-and-redirect req res)
      (= url "/login-and-redirect") (redirect-with-token req res)
      (re-find #"^/auth-completed-example" url) (auth-completed-example req res)
      :else
      (do
        (.writeHead res 404 (clj->js {"Content-Type" "text/plain"}))
        (.end res "Not Found.\n")))))


(defn -main [& args]
  (-> http
      (.createServer handle-request)
      (.listen 8000))
  (println "Server running."))


(set! *main-cli-fn* -main)
