SELECT np.dnorpattern             AS NUMBER, 
       np.description             AS DESCRIPTION, 
       cfd.cfavoicemailenabled AS CALL_FORWARD_ALL_VOICEMAIL_ENABLED, 
       cfd.cfadestination      AS CALL_FORWARD_ALL_DESTINATION, 
       cfbvoicemailenabled     AS BUSY_VOICEMAIL_ENABLED, 
       cfbdestination          AS BUSY_EXTERNAL_DESTINTATION, 
       cfbintvoicemailenabled  AS BUSY_INTERNAL_VOICEMAIL_ENABLED, 
       cfbintdestination       AS BUSY_INTERNAL_DESTINATION, 
       cfnavoicemailenabled    AS NOANSWER_VOICEMAIL_ENABLED, 
       cfnadestination         AS NO_ANSWERD_ESTINATION, 
       cfnaintvoicemailenabled AS NO_ANSWER_INTERNAL_VOICEMAIL_ENABLED, 
       cfnaintdestination      AS NO_ANSWER_INTERNAL_DESTINATION,
       rpt.name                AS PARTITION 
FROM   numplan np 
       INNER JOIN typepatternusage tpu 
               ON np.tkpatternusage = tpu.enum 
       LEFT OUTER JOIN callforwarddynamic AS cfd 
                    ON cfd.fknumplan = np.pkid 
       LEFT OUTER JOIN devicenumplanmap dnmp 
                    ON dnmp.fknumplan = np.pkid
       LEFT OUTER JOIN routepartition rpt
                    ON rpt.pkid = np.fkroutepartition 
WHERE  tpu.NAME = 'Device' 
       AND dnmp.pkid IS NULL 
ORDER  BY dnorpattern ASC