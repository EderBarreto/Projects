//Query for the record adicionar registro ao updateset através de script 
var rec = new GlideRecord('NOME_DA_TABELA');
if(rec.get('SYSID_DO_REGISTRO')){
    //Push the record into the current update set  
    var um = new GlideUpdateManager2();
    um.saveRecord(rec);
}