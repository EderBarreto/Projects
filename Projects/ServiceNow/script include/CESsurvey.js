(function executeRule(current, previous /*null when async*/) {
    // Add your code here
    //a tabela current é a tabela que está sendo executada o script, ou seja, a tabela asmt_metric_type 
    var value = current.getValue('actual_value');
    var instance = current
    if(value == 4 || value == 5){
        value = 'Good';
        }
    if(value == 3){
        value = 'Neutral';
        }
    if(value == 1 || value == 2){
        value = 'Bad';
        }
        
    
    var gr = new GlideRecord('asmt_assessment_instance');
    gr.get(instance);
    gr.setValue('u_survey_rating', value);
    gr.setDisplayValue('metric_type', 'virtual Agent Satisfaction Survey');

//chamaro scripit include updatelastsurvey
    var update = new UpdateLastSurvey();
    update.updateLastSurvey(instance);
    
    

    gr.update();


    

    

    
    
    
})(current, previous);