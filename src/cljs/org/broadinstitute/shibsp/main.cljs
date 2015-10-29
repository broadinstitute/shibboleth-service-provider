(ns org.broadinstitute.shibsp.main
  (:require
   [cljs.nodejs :as nodejs]
   cljs.pprint
   ))

(def fs (nodejs/require "fs"))
(def http (nodejs/require "http"))


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


(defn- send-info-page [req res]
  (let [body (atom "")]
    (.on req "data" (fn [chunk] (swap! body str chunk)))
    (.on
     req "end"
     (fn []
       (.writeHead res 200 (clj->js {"Content-Type" "text/plain"}))
       (.end
        res
        (str
         "Hello.\n"
         (.-method req) " " (.-url req) "\n"
         "Request headers were:\n"
         (JSON.stringify (.-headers req) nil 2) "\n"
         "Request body was:"
         (if (zero? (.-length @body))
           " (empty)"
           (str 
            "\n====================\n"
            @body
            "\n===================="))
         "\n"))))))


(defn- handle-request [req res]
  (let [url (.-url req)]
    (cond
      (and (= (-> js/process .-env .-DEV) "true") (= url "/restart"))
      (restart-server req res)
      :else
      (send-info-page req res)
      ;; :else
      #_(do
        (.writeHead res 404 (clj->js {"Content-Type" "text/plain"}))
        (.end res "Not Found.\n")))))


(defn -main [& args]
  (-> http
      (.createServer handle-request)
      (.listen 8000))
  (println "Server running."))


(set! *main-cli-fn* -main)
