(ns org.broadinstitute.shibsp.main
  (:require
   [cljs.nodejs :as nodejs]
   cljs.pprint
   clojure.string
   ))

(def fs (nodejs/require "fs"))
(def http (nodejs/require "http"))

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


(defn- redirect-with-token [req res]
  (let [nih-username (aget (.-headers req) "x-nih-username")
        nih-username (when nih-username (clojure.string/trim nih-username))
        nih-username (if (clojure.string/blank? nih-username) nil nih-username)
        redirect-url (-> js/process .-env .-SERVER_NAME)]
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


(defn- send-info-page [req res]
  (.writeHead res 200 (clj->js {"Content-Type" "text/html"}))
  (.end
   res
   (str
    "<html><head>Shibboleth Authentication Service</head>"
    "<body>"
    "<p>To authenticate, visit:</p>"
    "<a href=\"/link-nih-account\">/link-nih-account</a>"
    "</body>"
    "</html>"
    "\n")))


(defn- handle-request [req res]
  (let [url (.-url req)]
    (cond
      (= url "/") (send-info-page req res)
      (and (= (-> js/process .-env .-DEV) "true") (= url "/restart"))
      (restart-server req res)
      (= url "/link-nih-account") (redirect-with-token req res)
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
