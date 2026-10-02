-- =====================================================================
-- Carga inicial: Casa da Cultura e O Quebra-Nozes 2026
-- Escrito pelo Claude. Rodar uma vez, depois da migration da fundação.
-- Tudo aqui é editável depois pelo painel.
-- Horários em America/Belem (UTC-3).
-- =====================================================================

do $seed$
declare
  v_local uuid;
  v_mapa uuid;
  v_evento uuid;
  v_sab uuid;
  v_dom uuid;
  v_out uuid;
  v_nov uuid;
  v_colar uuid;
  v_buque uuid;
  v_premium uuid;
  v_joia uuid;
  v_ensaio uuid;
begin
  if exists (select 1 from public.eventos where slug = 'o-quebra-nozes-2026') then
    raise notice 'Carga inicial já aplicada. Nada foi alterado.';
    return;
  end if;

  -- Configurações globais
  insert into public.configuracoes (chave, valor, tipo, rotulo, explicacao, ordem) values
    ('razao_social', to_jsonb('Paiva Cursos e Treinamentos Ltda'::text), 'texto', 'Razão social', 'Aparece nos termos e nos comprovantes.', 1),
    ('cnpj', to_jsonb('56.048.285/0001-95'::text), 'texto', 'CNPJ', 'Precisa ser o mesmo da conta Pagar.me.', 2),
    ('endereco', to_jsonb('Tv. Barjonas de Miranda, 484, Aldeia, Santarém/PA, CEP 68040-525'::text), 'texto', 'Endereço', null, 3),
    ('whatsapp_recepcao', to_jsonb(''::text), 'texto', 'WhatsApp da recepção', 'Número que as famílias usam para falar com a recepção. Com DDD.', 4),
    ('hora_inicio_atendimento', to_jsonb('08:00'::text), 'hora', 'Início do atendimento', 'Aparece no link da família.', 5),
    ('hora_fim_atendimento', to_jsonb('20:00'::text), 'hora', 'Fim do atendimento', 'Aparece no link da família.', 6),
    ('contato_privacidade', to_jsonb('o WhatsApp da recepção'::text), 'texto', 'Contato para dados pessoais', 'Aparece na política de privacidade.', 7),
    ('dias_apagar_contatos', to_jsonb(30), 'numero', 'Dias até apagar contatos', 'Depois da última sessão de cada evento.', 8);

  -- Local, mapa e setores
  insert into public.locais (nome, endereco) values ('Casa da Cultura', 'Santarém/PA') returning id into v_local;
  insert into public.mapas (local_id, nome, colunas, filas, regra_numeracao, status)
  values (v_local, 'Plateia', 43, 11, 'continua', 'pronto') returning id into v_mapa;

  insert into public.setores (mapa_id, nome, cor, ordem) values
    (v_mapa, 'Diamond', '#2E9E5B', 1),
    (v_mapa, 'VIP', '#2F5AA8', 2),
    (v_mapa, 'Executivo', '#D23B3B', 3),
    (v_mapa, 'A definir', '#6B6257', 4);

  insert into public.mapa_celulas (mapa_id, linha, coluna, tipo, rotulo_fila, numero, setor_id, acessivel, bloqueado_padrao)
  select v_mapa, c.linha, c.coluna, c.tipo, c.rotulo_fila, c.numero, s.id, c.acessivel, c.bloqueado
  from (values
    (1,7,'palco',null,null,null,false,false),
    (1,8,'palco',null,null,null,false,false),
    (1,9,'palco',null,null,null,false,false),
    (1,10,'palco',null,null,null,false,false),
    (1,11,'palco',null,null,null,false,false),
    (1,12,'palco',null,null,null,false,false),
    (1,13,'palco',null,null,null,false,false),
    (1,14,'palco',null,null,null,false,false),
    (1,15,'palco',null,null,null,false,false),
    (1,16,'palco',null,null,null,false,false),
    (1,17,'palco',null,null,null,false,false),
    (1,18,'palco',null,null,null,false,false),
    (1,19,'palco',null,null,null,false,false),
    (1,20,'palco',null,null,null,false,false),
    (1,21,'palco',null,null,null,false,false),
    (1,22,'palco',null,null,null,false,false),
    (1,23,'palco',null,null,null,false,false),
    (1,24,'palco',null,null,null,false,false),
    (1,25,'palco',null,null,null,false,false),
    (1,26,'palco',null,null,null,false,false),
    (1,27,'palco',null,null,null,false,false),
    (1,28,'palco',null,null,null,false,false),
    (1,29,'palco',null,null,null,false,false),
    (1,30,'palco',null,null,null,false,false),
    (1,31,'palco',null,null,null,false,false),
    (1,32,'palco',null,null,null,false,false),
    (1,33,'palco',null,null,null,false,false),
    (1,34,'palco',null,null,null,false,false),
    (1,35,'palco',null,null,null,false,false),
    (1,36,'palco',null,null,null,false,false),
    (1,37,'palco',null,null,null,false,false),
    (3,21,'corredor',null,null,null,false,false),
    (3,22,'corredor',null,null,null,false,false),
    (3,23,'corredor',null,null,null,false,false),
    (4,21,'corredor',null,null,null,false,false),
    (4,22,'corredor',null,null,null,false,false),
    (4,23,'corredor',null,null,null,false,false),
    (5,21,'corredor',null,null,null,false,false),
    (5,22,'corredor',null,null,null,false,false),
    (5,23,'corredor',null,null,null,false,false),
    (6,21,'corredor',null,null,null,false,false),
    (6,22,'corredor',null,null,null,false,false),
    (6,23,'corredor',null,null,null,false,false),
    (7,21,'corredor',null,null,null,false,false),
    (7,22,'corredor',null,null,null,false,false),
    (7,23,'corredor',null,null,null,false,false),
    (8,21,'corredor',null,null,null,false,false),
    (8,22,'corredor',null,null,null,false,false),
    (8,23,'corredor',null,null,null,false,false),
    (9,21,'corredor',null,null,null,false,false),
    (9,22,'corredor',null,null,null,false,false),
    (9,23,'corredor',null,null,null,false,false),
    (10,21,'corredor',null,null,null,false,false),
    (10,22,'corredor',null,null,null,false,false),
    (10,23,'corredor',null,null,null,false,false),
    (11,21,'corredor',null,null,null,false,false),
    (11,22,'corredor',null,null,null,false,false),
    (11,23,'corredor',null,null,null,false,false),
    (3,20,'assento','1',1,'Diamond',false,false),
    (3,19,'assento','1',2,'Diamond',false,false),
    (3,18,'assento','1',3,'Diamond',false,false),
    (3,17,'assento','1',4,'Diamond',false,false),
    (3,16,'assento','1',5,'Diamond',false,false),
    (3,15,'assento','1',6,'Diamond',false,false),
    (3,14,'assento','1',7,'Diamond',false,false),
    (3,13,'assento','1',8,'Diamond',false,false),
    (3,12,'assento','1',9,'Diamond',false,false),
    (3,11,'assento','1',10,'Diamond',false,false),
    (3,10,'assento','1',11,'Diamond',false,false),
    (3,9,'assento','1',12,'Diamond',false,false),
    (3,8,'assento','1',13,'Diamond',false,false),
    (3,7,'assento','1',14,'Diamond',false,false),
    (4,20,'assento','2',15,'Diamond',false,false),
    (4,19,'assento','2',16,'Diamond',false,false),
    (4,18,'assento','2',17,'Diamond',false,false),
    (4,17,'assento','2',18,'Diamond',false,false),
    (4,16,'assento','2',19,'Diamond',false,false),
    (4,15,'assento','2',20,'Diamond',false,false),
    (4,14,'assento','2',21,'Diamond',false,false),
    (4,13,'assento','2',22,'Diamond',false,false),
    (4,12,'assento','2',23,'Diamond',false,false),
    (4,11,'assento','2',24,'Diamond',false,false),
    (4,10,'assento','2',25,'Diamond',false,false),
    (4,9,'assento','2',26,'Diamond',false,false),
    (4,8,'assento','2',27,'Diamond',false,false),
    (4,7,'assento','2',28,'Diamond',false,false),
    (4,6,'assento','2',29,'Diamond',false,false),
    (5,20,'assento','3',30,'Diamond',false,false),
    (5,19,'assento','3',31,'Diamond',false,false),
    (5,18,'assento','3',32,'Diamond',false,false),
    (5,17,'assento','3',33,'Diamond',false,false),
    (5,16,'assento','3',34,'Diamond',false,false),
    (5,15,'assento','3',35,'Diamond',false,false),
    (5,14,'assento','3',36,'Diamond',false,false),
    (5,13,'assento','3',37,'Diamond',false,false),
    (5,12,'assento','3',38,'Diamond',false,false),
    (5,11,'assento','3',39,'Diamond',false,false),
    (5,10,'assento','3',40,'Diamond',false,false),
    (5,9,'assento','3',41,'Diamond',false,false),
    (5,8,'assento','3',42,'Diamond',false,false),
    (5,7,'assento','3',43,'Diamond',false,false),
    (5,6,'assento','3',44,'Diamond',false,false),
    (5,5,'assento','3',45,'Diamond',false,false),
    (6,20,'assento','4',46,'Diamond',false,false),
    (6,19,'assento','4',47,'Diamond',false,false),
    (6,18,'assento','4',48,'Diamond',false,false),
    (6,17,'assento','4',49,'Diamond',false,false),
    (6,16,'assento','4',50,'Diamond',false,false),
    (6,15,'assento','4',51,'Diamond',false,false),
    (6,14,'assento','4',52,'Diamond',false,false),
    (6,13,'assento','4',53,'Diamond',false,false),
    (6,12,'assento','4',54,'Diamond',false,false),
    (6,11,'assento','4',55,'Diamond',false,false),
    (6,10,'assento','4',56,'Diamond',false,false),
    (6,9,'assento','4',57,'Diamond',false,false),
    (6,8,'assento','4',58,'Diamond',false,false),
    (6,7,'assento','4',59,'Diamond',false,false),
    (6,6,'assento','4',60,'Diamond',false,false),
    (6,5,'assento','4',61,'Diamond',false,false),
    (6,4,'assento','4',62,'Diamond',false,false),
    (7,19,'assento','5',63,'VIP',false,false),
    (7,18,'assento','5',64,'VIP',false,false),
    (7,17,'assento','5',65,'VIP',false,false),
    (7,16,'assento','5',66,'VIP',false,false),
    (7,15,'assento','5',67,'VIP',false,false),
    (7,11,'assento','5',68,'Executivo',false,false),
    (7,10,'assento','5',69,'Executivo',false,false),
    (7,9,'assento','5',70,'Executivo',false,false),
    (7,8,'assento','5',71,'Executivo',false,false),
    (7,7,'assento','5',72,'Executivo',false,false),
    (7,6,'assento','5',73,'Executivo',false,false),
    (7,5,'assento','5',74,'Executivo',false,false),
    (7,4,'assento','5',75,'Executivo',false,false),
    (8,18,'assento','6',76,'VIP',false,false),
    (8,17,'assento','6',77,'VIP',false,false),
    (8,16,'assento','6',78,'VIP',false,false),
    (8,15,'assento','6',79,'VIP',false,false),
    (8,14,'assento','6',80,'VIP',false,false),
    (8,13,'assento','6',81,'VIP',false,false),
    (8,11,'assento','6',82,'Executivo',false,false),
    (8,10,'assento','6',83,'Executivo',false,false),
    (8,9,'assento','6',84,'Executivo',false,false),
    (8,8,'assento','6',85,'Executivo',false,false),
    (8,7,'assento','6',86,'Executivo',false,false),
    (8,6,'assento','6',87,'Executivo',false,false),
    (8,5,'assento','6',88,'Executivo',false,false),
    (8,4,'assento','6',89,'Executivo',false,false),
    (8,3,'assento','6',90,'Executivo',false,false),
    (9,19,'assento','7',91,'VIP',false,false),
    (9,18,'assento','7',92,'VIP',false,false),
    (9,17,'assento','7',93,'VIP',false,false),
    (9,16,'assento','7',94,'VIP',false,false),
    (9,15,'assento','7',95,'VIP',false,false),
    (9,14,'assento','7',96,'VIP',false,false),
    (9,11,'assento','7',97,'Executivo',false,false),
    (9,10,'assento','7',98,'Executivo',false,false),
    (9,9,'assento','7',99,'Executivo',false,false),
    (9,8,'assento','7',100,'Executivo',false,false),
    (9,7,'assento','7',101,'Executivo',false,false),
    (9,6,'assento','7',102,'Executivo',false,false),
    (9,5,'assento','7',103,'Executivo',false,false),
    (9,4,'assento','7',104,'Executivo',false,false),
    (9,3,'assento','7',105,'Executivo',false,false),
    (9,2,'assento','7',106,'Executivo',false,false),
    (9,1,'assento','7',107,'Executivo',false,false),
    (10,20,'assento','8',108,'A definir',false,true),
    (10,19,'assento','8',109,'A definir',false,true),
    (10,18,'assento','8',110,'VIP',false,false),
    (10,17,'assento','8',111,'VIP',false,false),
    (10,16,'assento','8',112,'VIP',false,false),
    (10,15,'assento','8',113,'VIP',false,false),
    (10,14,'assento','8',114,'VIP',false,false),
    (10,13,'assento','8',115,'VIP',false,false),
    (10,11,'assento','8',116,'A definir',false,true),
    (10,10,'assento','8',117,'A definir',false,true),
    (10,9,'assento','8',118,'A definir',false,true),
    (10,8,'assento','8',119,'Executivo',false,false),
    (10,7,'assento','8',120,'Executivo',false,false),
    (10,6,'assento','8',121,'Executivo',false,false),
    (10,5,'assento','8',122,'Executivo',false,false),
    (10,4,'assento','8',123,'Executivo',false,false),
    (10,3,'assento','8',124,'Executivo',false,false),
    (10,2,'assento','8',125,'Executivo',false,false),
    (10,1,'assento','8',126,'Executivo',false,false),
    (3,24,'assento','1',127,'Diamond',false,false),
    (3,25,'assento','1',128,'Diamond',false,false),
    (3,26,'assento','1',129,'Diamond',false,false),
    (3,27,'assento','1',130,'Diamond',false,false),
    (3,28,'assento','1',131,'Diamond',false,false),
    (3,29,'assento','1',132,'Diamond',false,false),
    (3,30,'assento','1',133,'Diamond',false,false),
    (3,31,'assento','1',134,'Diamond',false,false),
    (3,32,'assento','1',135,'Diamond',false,false),
    (3,33,'assento','1',136,'Diamond',false,false),
    (3,34,'assento','1',137,'Diamond',false,false),
    (3,35,'assento','1',138,'Diamond',false,false),
    (3,36,'assento','1',139,'Diamond',false,false),
    (3,37,'assento','1',140,'Diamond',false,false),
    (4,24,'assento','2',141,'Diamond',false,false),
    (4,25,'assento','2',142,'Diamond',false,false),
    (4,26,'assento','2',143,'Diamond',false,false),
    (4,27,'assento','2',144,'Diamond',false,false),
    (4,28,'assento','2',145,'Diamond',false,false),
    (4,29,'assento','2',146,'Diamond',false,false),
    (4,30,'assento','2',147,'Diamond',false,false),
    (4,31,'assento','2',148,'Diamond',false,false),
    (4,32,'assento','2',149,'Diamond',false,false),
    (4,33,'assento','2',150,'Diamond',false,false),
    (4,34,'assento','2',151,'Diamond',false,false),
    (4,35,'assento','2',152,'Diamond',false,false),
    (4,36,'assento','2',153,'Diamond',false,false),
    (4,37,'assento','2',154,'Diamond',false,false),
    (4,38,'assento','2',155,'Diamond',false,false),
    (5,24,'assento','3',156,'Diamond',false,false),
    (5,25,'assento','3',157,'Diamond',false,false),
    (5,26,'assento','3',158,'Diamond',false,false),
    (5,27,'assento','3',159,'Diamond',false,false),
    (5,28,'assento','3',160,'Diamond',false,false),
    (5,29,'assento','3',161,'Diamond',false,false),
    (5,30,'assento','3',162,'Diamond',false,false),
    (5,31,'assento','3',163,'Diamond',false,false),
    (5,32,'assento','3',164,'Diamond',false,false),
    (5,33,'assento','3',165,'Diamond',false,false),
    (5,34,'assento','3',166,'Diamond',false,false),
    (5,35,'assento','3',167,'Diamond',false,false),
    (5,36,'assento','3',168,'Diamond',false,false),
    (5,37,'assento','3',169,'Diamond',false,false),
    (5,38,'assento','3',170,'Diamond',false,false),
    (5,39,'assento','3',171,'Diamond',false,false),
    (6,24,'assento','4',172,'Diamond',false,false),
    (6,25,'assento','4',173,'Diamond',false,false),
    (6,26,'assento','4',174,'Diamond',false,false),
    (6,27,'assento','4',175,'Diamond',false,false),
    (6,28,'assento','4',176,'Diamond',false,false),
    (6,29,'assento','4',177,'Diamond',false,false),
    (6,30,'assento','4',178,'Diamond',false,false),
    (6,31,'assento','4',179,'Diamond',false,false),
    (6,32,'assento','4',180,'Diamond',false,false),
    (6,33,'assento','4',181,'Diamond',false,false),
    (6,34,'assento','4',182,'Diamond',false,false),
    (6,35,'assento','4',183,'Diamond',false,false),
    (6,36,'assento','4',184,'Diamond',false,false),
    (6,37,'assento','4',185,'Diamond',false,false),
    (6,38,'assento','4',186,'Diamond',false,false),
    (6,39,'assento','4',187,'Diamond',false,false),
    (6,40,'assento','4',188,'Diamond',false,false),
    (7,24,'assento','5',189,'VIP',false,false),
    (7,25,'assento','5',190,'VIP',false,false),
    (7,26,'assento','5',191,'VIP',false,false),
    (7,27,'assento','5',192,'VIP',false,false),
    (7,28,'assento','5',193,'VIP',false,false),
    (7,29,'assento','5',194,'VIP',false,false),
    (7,30,'assento','5',195,'VIP',false,false),
    (7,31,'assento','5',196,'VIP',false,false),
    (7,33,'assento','5',197,'Executivo',false,false),
    (7,34,'assento','5',198,'Executivo',false,false),
    (7,35,'assento','5',199,'Executivo',false,false),
    (7,36,'assento','5',200,'Executivo',false,false),
    (7,37,'assento','5',201,'Executivo',false,false),
    (7,38,'assento','5',202,'Executivo',false,false),
    (7,39,'assento','5',203,'Executivo',false,false),
    (7,40,'assento','5',204,'Executivo',false,false),
    (7,41,'assento','5',205,'Executivo',false,false),
    (8,24,'assento','6',206,'VIP',false,false),
    (8,25,'assento','6',207,'VIP',false,false),
    (8,26,'assento','6',208,'VIP',false,false),
    (8,27,'assento','6',209,'VIP',false,false),
    (8,28,'assento','6',210,'VIP',false,false),
    (8,29,'assento','6',211,'VIP',false,false),
    (8,30,'assento','6',212,'VIP',false,false),
    (8,31,'assento','6',213,'VIP',false,false),
    (8,33,'assento','6',214,'Executivo',false,false),
    (8,34,'assento','6',215,'Executivo',false,false),
    (8,35,'assento','6',216,'Executivo',false,false),
    (8,36,'assento','6',217,'Executivo',false,false),
    (8,37,'assento','6',218,'Executivo',false,false),
    (8,38,'assento','6',219,'Executivo',false,false),
    (8,39,'assento','6',220,'Executivo',false,false),
    (8,40,'assento','6',221,'Executivo',false,false),
    (8,41,'assento','6',222,'Executivo',false,false),
    (8,42,'assento','6',223,'Executivo',false,false),
    (9,24,'assento','7',224,'VIP',false,false),
    (9,25,'assento','7',225,'VIP',false,false),
    (9,26,'assento','7',226,'VIP',false,false),
    (9,27,'assento','7',227,'VIP',false,false),
    (9,28,'assento','7',228,'VIP',false,false),
    (9,29,'assento','7',229,'VIP',false,false),
    (9,30,'assento','7',230,'VIP',false,false),
    (9,31,'assento','7',231,'VIP',false,false),
    (9,33,'assento','7',232,'Executivo',false,false),
    (9,34,'assento','7',233,'Executivo',false,false),
    (9,35,'assento','7',234,'Executivo',false,false),
    (9,36,'assento','7',235,'Executivo',false,false),
    (9,37,'assento','7',236,'Executivo',false,false),
    (9,38,'assento','7',237,'Executivo',false,false),
    (9,39,'assento','7',238,'Executivo',false,false),
    (9,40,'assento','7',239,'Executivo',false,false),
    (9,41,'assento','7',240,'Executivo',false,false),
    (9,42,'assento','7',241,'Executivo',false,false),
    (9,43,'assento','7',242,'Executivo',false,false),
    (10,24,'assento','8',243,'A definir',false,true),
    (10,25,'assento','8',244,'A definir',false,true),
    (10,26,'assento','8',245,'VIP',false,false),
    (10,27,'assento','8',246,'VIP',false,false),
    (10,28,'assento','8',247,'VIP',false,false),
    (10,29,'assento','8',248,'VIP',false,false),
    (10,30,'assento','8',249,'VIP',false,false),
    (10,31,'assento','8',250,'A definir',false,true),
    (10,33,'assento','8',251,'Executivo',false,false),
    (10,34,'assento','8',252,'Executivo',false,false),
    (10,35,'assento','8',253,'Executivo',false,false),
    (10,36,'assento','8',254,'Executivo',false,false),
    (10,37,'assento','8',255,'Executivo',false,false),
    (10,38,'assento','8',256,'Executivo',false,false),
    (10,39,'assento','8',257,'Executivo',false,false),
    (10,40,'assento','8',258,'Executivo',false,false),
    (10,41,'assento','8',259,'Executivo',false,false),
    (10,42,'assento','8',260,'Executivo',false,false),
    (10,43,'assento','8',261,'Executivo',false,false),
    (11,1,'assento','9',262,'A definir',false,true),
    (11,2,'assento','9',263,'A definir',false,true),
    (11,3,'assento','9',264,'A definir',false,true),
    (11,4,'assento','9',265,'A definir',false,true),
    (11,5,'assento','9',266,'A definir',false,true),
    (11,6,'assento','9',267,'A definir',false,true),
    (11,7,'assento','9',268,'A definir',false,true),
    (11,8,'assento','9',269,'A definir',false,true),
    (11,9,'assento','9',270,'A definir',false,true),
    (11,10,'assento','9',271,'A definir',false,true),
    (11,11,'assento','9',272,'A definir',false,true),
    (11,33,'assento','9',273,'A definir',false,true),
    (11,34,'assento','9',274,'A definir',false,true),
    (11,35,'assento','9',275,'A definir',false,true),
    (11,36,'assento','9',276,'A definir',false,true),
    (11,37,'assento','9',277,'A definir',false,true),
    (11,38,'assento','9',278,'A definir',false,true),
    (11,39,'assento','9',279,'A definir',false,true),
    (11,40,'assento','9',280,'A definir',false,true),
    (11,41,'assento','9',281,'A definir',false,true),
    (11,42,'assento','9',282,'A definir',false,true)
  ) as c(linha, coluna, tipo, rotulo_fila, numero, setor, acessivel, bloqueado)
  left join public.setores s on s.mapa_id = v_mapa and s.nome = c.setor;

  -- Evento e sessões
  insert into public.eventos (nome, slug, status, tema, cota_por_participante, limite_por_pedido, tempo_reserva_min, parcelamento_min_ingressos, parcelas_max, meia_percentual)
  values ('O Quebra-Nozes 2026', 'o-quebra-nozes-2026', 'rascunho', 'quebra-nozes', 3, 10, 15, 3, 3, 40)
  returning id into v_evento;

  insert into public.sessoes (evento_id, nome, mapa_id, ordem) values (v_evento, 'Sábado, 28 de novembro', v_mapa, 1) returning id into v_sab;
  insert into public.sessoes (evento_id, nome, mapa_id, ordem) values (v_evento, 'Domingo, 29 de novembro', v_mapa, 2) returning id into v_dom;
  perform public._congelar_mapa(v_sab);
  perform public._congelar_mapa(v_dom);

  -- Preços
  insert into public.periodos_preco (evento_id, nome, inicio, fim, modo, rotulo_unico)
  values (v_evento, 'Outubro', '2026-10-01 00:00-03', '2026-11-01 00:00-03', 'unico', 'Meia-entrada para todos')
  returning id into v_out;
  insert into public.periodos_preco (evento_id, nome, inicio, fim, modo)
  values (v_evento, 'A partir de 1º de novembro', '2026-11-01 00:00-03', '2026-11-30 00:00-03', 'inteira_meia')
  returning id into v_nov;

  insert into public.precos (periodo_id, setor_id, tipo, valor_centavos)
  select v_out, s.id, 'unico', v.valor from public.setores s
  join (values ('Diamond', 24000), ('VIP', 22000), ('Executivo', 20000)) v(nome, valor) on v.nome = s.nome
  where s.mapa_id = v_mapa;
  insert into public.precos (periodo_id, setor_id, tipo, valor_centavos)
  select v_nov, s.id, v.tipo, v.valor from public.setores s
  join (values ('Diamond', 'inteira', 48000), ('VIP', 'inteira', 44000), ('Executivo', 'inteira', 40000),
               ('Diamond', 'meia', 24000), ('VIP', 'meia', 22000), ('Executivo', 'meia', 20000)) v(nome, tipo, valor) on v.nome = s.nome
  where s.mapa_id = v_mapa;

  -- Calendário da bilheteria
  insert into public.janelas (evento_id, tipo, inicio, fim, observacao) values
    (v_evento, 'quebra_nozes', '2026-10-09 08:00-03', '2026-10-09 20:00-03', 'Famílias com pacote Quebra-Nozes, com horário marcado, na recepção'),
    (v_evento, 'presencial', '2026-10-10 08:00-03', '2026-10-10 20:00-03', 'Todas as famílias, na recepção, sem limite'),
    (v_evento, 'online_familias', '2026-10-11 10:00-03', '2026-11-01 00:00-03', 'Link da família, com saldo'),
    (v_evento, 'publico', '2026-11-01 00:00-03', '2026-11-29 23:59-03', 'Link público, com limite por pedido'),
    (v_evento, 'retirada', '2026-11-16 08:00-03', '2026-11-27 20:00-03', 'Retirada dos ingressos físicos na recepção');

  -- Adicionais
  insert into public.estoques (evento_id, nome) values (v_evento, 'Colar do Quebra-Nozes') returning id into v_colar;
  insert into public.lotes (estoque_id, numero, quantidade, aberto) values (v_colar, 1, 20, true), (v_colar, 2, 30, false);

  insert into public.produtos (evento_id, nome, descricao, preco_antecipado_centavos, preco_cheio_centavos, venda_online_ate, entrega, ativo, ordem)
  values (v_evento, 'Buquê com arranjo ornamental', '4 rosas.', 18000, 24000, '2026-11-01 00:00-03', 'na_sessao', true, 1) returning id into v_buque;
  insert into public.produtos (evento_id, nome, descricao, preco_antecipado_centavos, preco_cheio_centavos, venda_online_ate, entrega, ativo, ordem)
  values (v_evento, 'Buquê premium com Jóia do Elenco', '8 rosas e o colar do Quebra-Nozes.', 42000, 48000, '2026-11-01 00:00-03', 'na_sessao', true, 2) returning id into v_premium;
  insert into public.produtos (evento_id, nome, descricao, preco_antecipado_centavos, preco_cheio_centavos, venda_online_ate, entrega, ativo, ordem)
  values (v_evento, 'Jóia do Elenco', 'O colar do Quebra-Nozes.', 8000, 12000, '2026-11-01 00:00-03', 'na_sessao', true, 3) returning id into v_joia;
  insert into public.produtos (evento_id, nome, descricao, venda_online_ate, entrega, ativo, ordem)
  values (v_evento, 'Ensaio fotográfico', 'Defina preço e descrição no painel antes de ativar.', '2026-11-01 00:00-03', 'agendada', false, 4) returning id into v_ensaio;

  insert into public.produto_estoque (produto_id, estoque_id, quantidade) values (v_premium, v_colar, 1), (v_joia, v_colar, 1);
  insert into public.produto_datas (produto_id, data, vagas, reservas_internas) values (v_ensaio, null, 18, 9);

  -- Conteúdos do evento
  insert into public.conteudos (evento_id, chave, rotulo, texto) values
    (v_evento, 'mensagem_link', $t$Mensagem do link (WhatsApp)$t$, $t$Oi, {{responsavel}}.
Este é o link da plateia de {{bailarinas}} em O Quebra-Nozes:
{{link}}
É por ele que você acompanha a bilheteria e escolhe os lugares da família. O link é só de vocês; guarde esta mensagem.$t$),
    (v_evento, 'comprovante_presencial', $t$Comprovante da recepção (WhatsApp)$t$, $t${{responsavel}}, os lugares de vocês em O Quebra-Nozes:
{{lista_ingressos}}
Os ingressos com QR ficam no link da família: {{link}}$t$),
    (v_evento, 'familia_titulo', $t$Topo da página da família$t$, $t$A plateia de {{bailarinas}}$t$),
    (v_evento, 'dia_bloco', $t$Bloco de cada sessão$t$, $t${{dia}}: {{bailarinas_do_dia}} sobem ao palco$t$),
    (v_evento, 'dia_lugares', $t$Lugares da família no dia$t$, $t$Lugares da família neste dia: {{saldo}}$t$),
    (v_evento, 'dia_garantido', $t$Saldo zero no dia$t$, $t$Os lugares da família para {{dia}} já estão garantidos.$t$),
    (v_evento, 'antes_online', $t$Antes da abertura do link$t$, $t$A escolha de lugares por este link abre em 11 de outubro, às 10h. Antes disso, a bilheteria funciona na recepção do Ballet: dia 9 para as famílias Quebra-Nozes, dia 10 para todas.$t$),
    (v_evento, 'preco_outubro', $t$Junto do preço em outubro$t$, $t${{valor}}, meia-entrada para todos até 31 de outubro. Inteira a partir de 1º de novembro: {{valor_inteira}}.$t$),
    (v_evento, 'reserva_tempo', $t$Tempo da reserva$t$, $t$Seus lugares ficam guardados por {{minutos}} minutos.$t$),
    (v_evento, 'reserva_expirou', $t$Reserva vencida$t$, $t$O tempo acabou e os lugares voltaram para o mapa. Escolha de novo quando quiser.$t$),
    (v_evento, 'pix_instrucao', $t$Tela do PIX$t$, $t$Abra o app do seu banco, escolha PIX e cole o código. Esta página atualiza sozinha quando o pagamento chegar.$t$),
    (v_evento, 'cartao_recusado', $t$Cartão recusado$t$, $t$O banco não aprovou este cartão. Você pode tentar outro cartão ou pagar com PIX.$t$),
    (v_evento, 'confirmacao', $t$Após o pagamento$t$, $t$Tudo certo. Os ingressos estão aqui, neste link, sempre que precisar.$t$),
    (v_evento, 'lembrete_filmagem', $t$Lembrete de filmagem$t$, $t$Filmar pode, do seu lugar, sem flash e sem atrapalhar quem está atrás.$t$),
    (v_evento, 'desistencia_linha', $t$Linha de desistência$t$, $t$Desistir desta compra (disponível até {{data_limite}})$t$),
    (v_evento, 'desistencia_confirmar', $t$Janela de desistência$t$, $t$Os lugares voltam para o mapa e o valor é devolvido pelo mesmo meio de pagamento.$t$),
    (v_evento, 'link_substituido', $t$Link antigo$t$, $t$Este link foi substituído. Fale com a recepção para receber o novo.$t$),
    (v_evento, 'mapa_completo', $t$Sem lugares no dia$t$, $t$Os lugares do mapa para {{dia}} foram preenchidos. Fale com a recepção.$t$),
    (v_evento, 'ajuda', $t$Rodapé da página$t$, $t$Falar com a recepção, das {{hora_inicio}} às {{hora_fim}}$t$),
    (v_evento, 'lote_colar', $t$Adicionais com colar$t$, $t$1º lote$t$),
    (v_evento, 'lote_colar_esgotado', $t$Primeiro lote esgotado$t$, $t$1º lote esgotado$t$),
    (v_evento, 'ensaio_vagas', $t$Vagas do ensaio$t$, $t${{vagas}} vagas$t$),
    (v_evento, 'adicionais_novembro', $t$Adicionais a partir de 1/11$t$, $t$Os adicionais agora são vendidos na recepção.$t$),
    (v_evento, 'retirada_aviso', $t$Carteira de ingressos$t$, $t$Os ingressos impressos ficam prontos para retirada na recepção de {{retirada_inicio}} a {{retirada_fim}}. É só mostrar este link.$t$);

  -- Termos do evento e política de privacidade (versão 1)
  insert into public.termos_versoes (evento_id, tipo, texto) values (v_evento, 'termos', $t$TERMOS DE COMPRA: O QUEBRA-NOZES 2026

1. Quem vende. Paiva Cursos e Treinamentos Ltda (antiga Highlight Eventos Ltda), CNPJ 56.048.285/0001-95, Tv. Barjonas de Miranda, 484, Aldeia, Santarém/PA, CEP 68040-525, mantenedora do Ballet Letícia Lobo.

2. O que é vendido. Ingressos com lugar numerado para o espetáculo O Quebra-Nozes, na Casa da Cultura de Santarém, nas sessões de 28 e 29 de novembro de 2026, e os adicionais oferecidos no catálogo.

3. Etapas de venda. A venda acontece em etapas informadas no link: recepção em 9 e 10 de outubro, link das famílias a partir de 11 de outubro e venda ao público a partir de 1º de novembro.

4. Lugares das famílias. Até a abertura ao público, cada família compra pelo link até 3 ingressos por bailarina, por sessão em que ela dança, somados entre as irmãs. Compras feitas na recepção contam nesse total.

5. Preços em outubro. Até 31 de outubro, todos pagam o valor de meia-entrada. Essa condição tem prazo determinado e não se acumula com o benefício da meia-entrada, porque o comprador já paga metade da inteira.

6. Preços a partir de 1º de novembro. Valem inteira e meia-entrada. A meia-entrada segue a Lei 12.933/2013, o Decreto 8.537/2015 e o Estatuto da Pessoa Idosa: estudantes, pessoas com deficiência e seu acompanhante quando necessário, jovens de 15 a 29 anos de baixa renda inscritos no CadÚnico e pessoas com 60 anos ou mais, até 40% dos ingressos de cada sessão. Ao escolher meia-entrada, o comprador declara ter o direito.

7. Pagamento. No link, PIX ou cartão. Pedidos com 3 ingressos ou mais podem ser pagos em até 3 vezes sem juros no cartão. Na recepção, cartão, PIX ou dinheiro, com a mesma regra de parcelamento. Os lugares escolhidos ficam reservados por 15 minutos até o pagamento.

8. Crianças de colo. Crianças até 2 anos, que ainda não completaram 3, entram no colo sem ingresso, uma por adulto com ingresso, mediante documento ou certidão na entrada.

9. Desistência. Compras feitas pelo link podem ser desfeitas em até 7 dias corridos, conforme o artigo 49 do Código de Defesa do Consumidor, por "Detalhes da compra" no link ou pela recepção. O valor é devolvido integralmente pelo mesmo meio de pagamento. Compras feitas na recepção não têm direito de arrependimento.

10. Cancelamento ou adiamento pelo organizador. O comprador escolhe entre a devolução integral e o uso do ingresso na nova data.

11. Repasse. O ingresso não é nominal e pode ser repassado. Antes do espetáculo, a família retira na recepção os ingressos físicos, apresentando o QR do link, no período informado no link. Quem usa um ingresso de meia-entrada precisa ter o direito.

12. Troca de lugar. Pela recepção, conforme a disponibilidade.

13. Entrada. O horário de abertura das portas aparece no link. A entrada é feita com o ingresso físico; o QR do link também é aceito. Os lugares são numerados; recomenda-se chegar com antecedência.

14. Filmagem e fotos. A plateia pode filmar e fotografar do próprio lugar, sem flash e sem atrapalhar quem está atrás. A produção oficial filma e fotografa o espetáculo, e a plateia pode aparecer nessas imagens.

15. Adicionais. Os valores antecipados valem até 31 de outubro, no link e na recepção. A partir de 1º de novembro, os adicionais são vendidos só na recepção, pelo valor cheio, conforme o estoque. Buquês e jóias são entregues na Casa da Cultura, no dia da sessão indicada no pedido. O ensaio fotográfico é agendado pela equipe depois da compra. Adicionais comprados pelo link seguem a regra de desistência do item 9.

16. Dados pessoais. Tratados conforme a Política de Privacidade.

17. Foro. Comarca de Santarém/PA, sem prejuízo do direito do consumidor de usar o foro do seu domicílio.$t$);
  insert into public.termos_versoes (evento_id, tipo, texto) values (null, 'privacidade', $t$POLÍTICA DE PRIVACIDADE

1. Quem trata os dados. Paiva Cursos e Treinamentos Ltda, CNPJ 56.048.285/0001-95, mantenedora do Ballet Letícia Lobo. Contato para assuntos de dados pessoais: {{contato_privacidade}}.

2. Que dados usamos.
- Do responsável: primeiro nome e WhatsApp, vindos da inscrição no espetáculo.
- Das bailarinas: nome, turma, pacote e dias em que dançam, vindos da inscrição. A família vê só os primeiros nomes.
- De quem paga: nome, CPF, e-mail e celular, pedidos pela Pagar.me para processar o pagamento.
- Técnicos: data, hora e IP do aceite dos termos, e registros de acesso.
- Não usamos data de nascimento, CPF de bailarina nem endereço. Dados de cartão são tratados só pela Pagar.me e nunca passam pelos nossos sistemas.

3. Para quê. Organizar a plateia de cada família e vender os ingressos (execução de contrato); emitir comprovantes e cumprir obrigações fiscais (obrigação legal); prevenir fraude e defender direitos (exercício regular de direitos). Os dados das bailarinas são usados no melhor interesse delas, dentro do contrato de participação no espetáculo firmado pelo responsável.

4. Com quem compartilhamos. Pagar.me, para o pagamento; o provedor de hospedagem do sistema; e o WhatsApp, quando a escola envia mensagens. Não vendemos nem cedemos dados para publicidade.

5. Por quanto tempo. Nomes das bailarinas, WhatsApp dos responsáveis e links são apagados 30 dias depois da última sessão de cada evento. O registro de cada compra (nome e CPF de quem pagou, valores, datas, forma de pagamento e aceite dos termos) fica guardado por 5 anos, por obrigação fiscal e para defesa de direitos.

6. Segurança. Acesso restrito por papel, link individual por família que pode ser trocado a qualquer momento, e registro de toda ação da equipe.

7. Seus direitos. Você pode pedir acesso, correção, exclusão, portabilidade e informações sobre o uso dos seus dados pelo contato do item 1. Pedidos de exclusão respeitam o prazo legal de guarda do item 5.

8. Cookies. Usamos só os necessários para o sistema funcionar. Não há rastreamento para publicidade.

9. Atualizações. Cada versão desta política fica registrada, com data de publicação.$t$);
end
$seed$;
