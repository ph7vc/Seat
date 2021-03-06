from seat.applications.QuestionApplication import QuestionApplication
from seat.models.exam import Question
from django.http import JsonResponse
from api.helpers import endpoint_checks
import json
import logging

logger = logging.getLogger(__name__)

questionApplication = QuestionApplication()

# POST -- NOW UPSERT
def upsert_question_success_json_model(question_id):
    return JsonResponse({
        'success': True,
        'error': False,
        'id': str(question_id)
    })

def upsert_question_failure_json_model(message):
    return JsonResponse({
        'success' : False,
        'error' : True,
        'message' : str(message)
    })

def upsert_question_logic(teacher, request):
    try:
        question = json.loads(request.POST.get('question'))
        exam_id = request.POST['exam_id']
        if not endpoint_checks.id_is_valid(exam_id):
            return upsert_question_failure_json_model("Invalid exam id")
        modified_question, message = questionApplication.upsert_question(teacher, exam_id, question)
        if modified_question == False:
            return upsert_question_failure_json_model(message)
        return upsert_question_success_json_model(modified_question.id)
    except Exception as error:
        logger.warn("problem upserting question! :"+str(error))
        return upsert_question_failure_json_model('Failed to upsert the question, sorry. This is probably a database error.')

def upsert_question(request):
    return endpoint_checks.standard_teacher_endpoint(
        "upsert_question",
        ['exam_id', 'question'],
        'POST',
        request,
        upsert_question_logic
        )

# DELETE
def delete_question_success_json_model():
    return JsonResponse({
        'success': True,
        'error': False
    })

def delete_question_failure_json_model(message):
    return JsonResponse({
        'success' : False,
        'error' : True,
        'message' : str(message)
    })

def delete_question_logic(teacher, request):
    try:
        question_id = request.DELETE['question_id']
        if not endpoint_checks.id_is_valid(question_id):
            return delete_question_failure_json_model("Invalid question id")
        success, message = questionApplication.delete_question(teacher, question_id)
        if not success:
            return delete_question_failure_json_model(message)
        return delete_question_success_json_model()
    except Exception, error:
        logger.warn("problem deleting question! :"+str(error))
        return delete_question_failure_json_model('Failed to delete the question, sorry. This is probably a database error.')

def delete_question(request):
    return endpoint_checks.standard_teacher_endpoint(
        "delete_question",
        ['question_id'],
        'DELETE',
        request,
        delete_question_logic
        )

# GET
def get_question_success_json_model(question):
    return JsonResponse({
        'success': True,
        'error': False,
        'question' : json.dumps(question.prep_for_serialization())
    })

def get_question_failure_json_model(message):
    return JsonResponse({
        'success' : False,
        'error' : True,
        'message' : str(message)
    })

def get_question_logic(teacher, request):
    try:
        question_id = request.GET['question_id']
        if not endpoint_checks.id_is_valid(question_id):
            return get_question_failure_json_model("Invalid question id")

        question = Question.objects.filter(id=question_id, exam__course__teacher=teacher)
        if not question.exists():
            return get_question_failure_json_model("Question not found")

        return get_question_success_json_model(question)
    except Exception, error:
        logger.warn("problem getting question! :"+str(error))
        return get_question_failure_json_model('Failed to get the question, sorry. This is probably a database error.')

def get_question(request):
    return endpoint_checks.standard_teacher_endpoint(
        "get_question",
        ['question_id'],
        'POST',
        request,
        get_question_logic
        )
