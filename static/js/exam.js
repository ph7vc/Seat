document.addEventListener("DOMContentLoaded", function() {
	const questions_present_at_pageload = JSON.parse($('#backend-data-delivery').val());
	const question_list_selector = '.question-list';
	const max_prompt_length_without_ellipses = 35;
	const use_ellipses_on_truncated_prompt = true;
	const exam_id = $('#exam-id').val();
	const api_endpoint_for_questions = '/api/question';
	const static_properties_of_questions = {
		"multichoice" : {
			template_selector : '.multichoice.template'
		},
		"multiselect": {
			template_selector : '.multiselect.template'
		},
		"shortanswer" : {
			template_selector : '.shortanswer.template'
		},
		"essay" : {
			template_selector : '.essay.template'
		},
		"truefalse" : {
			template_selector : '.truefalse.template'
		}
	};

	var templates = {}

	/* ------------ begin multichoice ------------- */
	const MultiChoiceQuestion = function() {
		const multichoice = this;
		multichoice.type = "multichoice";
		multichoice.manifestation = copy_template_and_create(multichoice.type);

		var my_data = multichoice._data = {
			'question_id' 	: '',
			'type' 			: 'multichoice',
			'prompt' 		: '',
			'points' 		: '',
			'number' 		: '',
			'options' 		: [],
			'answers' 		: []
		}

		/* selector : action so we can later do multichoice[action]() */
		const action_map = {
			'.questionSubmit' 		: 	'submit',
			'.questionDelete' 		: 	'delete',
			'.questionAddChoice'	: 	'add_choice',
			'.questionEdit' 		: 	'edit',
			'.questionSummary'		:	'summary',
			'.questionReset'		:	'reset',
		}

		this._old_data = JSON.parse(JSON.stringify(my_data));// hacky, but hey!


		function wire_for_selector(selector) {
			return function(e) {
				multichoice[action_map[selector]]();
				console.log(selector);
			}
		}

		for (var selector in action_map) {
			multichoice.manifestation.find(selector).on('click', wire_for_selector(selector));
		}

		const my_derived_sections = {
			'prompt' : ['prompt-substr']
		};

		/* prompt-substr is a projection, (read only) the others
        are pure data, meaning they are bound more generically */
		multichoice.prompt_substr = function() {
			if (arguments.length > 0) 
				console.log('argument ignored in .prompt_substr, which is read-only');

			const truncated_prompt = multichoice._data['prompt'].substr(0, max_prompt_length_without_ellipses);

			if (use_ellipses_on_truncated_prompt 
				&& truncated_prompt.length == max_prompt_length_without_ellipses) {

				return truncated_prompt + '...';
			}

			return truncated_prompt;
		}

		/* this function exposes all of the data for multichoice,
        -> for example question_id as a getter/setter <-
        setting it sets it internally and updates all of the places in the
        markup that are annotated data-x="question_id":
        some_multichoice_question.question_id(123)
        some_multichoice_question.question_id() <- 123 */
		var bind_property_to_multichoice_as_getter_setter = function(property) {
			multichoice[property] = function(value) {
				if (arguments.length > 0) {
					/* set */
					multichoice._data[property] = value;

					/* this block of code handles setting things like prompt-substr */
					if (my_derived_sections[property]) {
						for (var i in my_derived_sections[property]) {
							/* data-x attributes often have -'s in them, switch to _,
                              for example this lets us grab data-x="prompt-substr",
                              and populate it using our own getter, prompt_substr */
							var derived_property = my_derived_sections[property][i].replace(/-/gm, '_');
							multichoice.manifestation.find(
								'[data-x="'+my_derived_sections[property][i]+'"]'
							)
							.val(multichoice[derived_property]())
							.text(multichoice[derived_property]());
						}
					}
					var children = multichoice.manifestation.find('[data-x="'+property+'"]');
					children.val(value);
					children.text(value);
					return multichoice;
				} else {
					/* get */
					return multichoice._data[property]
				}
			}
		}

		/* expose all of the properties */
		for (var property_to_be_available in my_data) {
			if (is_type_of([], my_data[property_to_be_available])) continue;

			bind_property_to_multichoice_as_getter_setter(property_to_be_available);
			bind_property_to_on_change(property_to_be_available)
		}

		function bind_property_to_on_change(property) {
			var children = multichoice.manifestation.find('[data-x="'+property+'"]');
			children.on('change', function(e) {
				const val = $(this).val();
				multichoice[property](val);
			});
		}

		multichoice.options = function() {
			return multichoice._data['options'];
		}

		multichoice.answers = function() {
			return multichoice._data['answers'];
		}

		const get_multichoice_option_index_in_options = function(multichoice_option) {
			var index = -1;
			multichoice.manifestation.find('.multichoice-edit-option').each(function(i,v){
				console.log($(v).attr('data-member'), multichoice_option.attr('data-member'))
				if ($(v).attr('data-member') === multichoice_option.attr('data-member')) {
					index = i;
					console.log(index)
				}
			})
			return index;
		}

		const delete_option = function(multichoice_option) {
			var index = get_multichoice_option_index_in_options(multichoice_option);
			multichoice._data['options'].splice(index,1);
			console.log('index', 'array post slice', index, multichoice._data['options'])
			var answer_element = multichoice_option.find('[data-x="answer"]');
			if (answer_element.is(':checked')) {
				var answer_index = multichoice._data['answers'].indexOf(answer_element.val().trim());
				if (answer_index >= 0 && answer_index !== false) {
					multichoice._data['answers'].splice(answer_index,1);
				}
			}

			multichoice_option.remove();
			multichoice.manifestation.find('[data-x="option-count"]').text(multichoice.option_count());
			multichoice.manifestation.find('[data-x="option-count"]').val(multichoice.option_count());
		}

		const wireup_delete_for_option = function(multichoice_option) {
			/* wirup delete for this guy */
			multichoice_option.find('.delete-option').on('click', function() {
				delete_option(multichoice_option);
			})
		}

		multichoice.option_count = function() {
			return multichoice._data['options'].length;	
		}

		var identifier_counter = 0;
		multichoice.add_choice = function(text, is_answer) {

			identifier_counter++;
			if (!text) text = '';
			multichoice._data['options'].push(text);

			/*  update count */
			console.log('option count updated')
			multichoice.manifestation.find('[data-x="option-count"]').text(multichoice.option_count())
			multichoice.manifestation.find('[data-x="option-count"]').val(multichoice.option_count())

			new_edit_option = $('.multichoice-edit-option.template')
			.clone()
			.removeClass('template')
			.show()
			.attr('data-member', identifier_counter);
			console.log(new_edit_option)
			/* set text */
			new_edit_option.find('[data-x="option"]').val(text)

			if (is_answer && is_answer === true) {
				multichoice._data['answers'].push(text);
				new_edit_option.find('[data-x="answer"]').prop('checked', true)
			} else {
				new_edit_option.find('[data-x="answer"]').prop('checked', false)
			}

			/* add to dom */
			new_edit_option.appendTo(multichoice.manifestation.find('.options'));

			/* wirup delete */
			wireup_delete_for_option(new_edit_option);

			/* onchange */
			new_edit_option.find('[data-x="answer"]').on('change', function() {
				multichoice._data['answers'] = [];
				multichoice.manifestation.find('[data-x="answer"]').each(function(i,v) {
					if ($(v).is(':checked')) 
						multichoice._data['answers'].push(
							$(v).closest('.option-container').find('[data-x="option"]').val().trim())
						});
			});

			/* only for teachers in the edit page really, normal dom elements don't change much */
			new_edit_option.find('[data-x="option"]').on('change', function() {
				multichoice._data['options'] = [];
				multichoice.manifestation.find('[data-x="option"]').each(function(i,v) {
					multichoice._data['options'].push($(v).val().trim());
				})
			});

			multichoice.init();

		}

		multichoice.reset = function(data) {
			multichoice.populate(this._old_data);
		}

		multichoice.populate = function(data) {
			for (var property in multichoice._data) {
				if (is_type_of('', data[property]) || is_type_of(0, data[property])) {
					/* this passes the data at data['question_id'] to multichoice.question_id()
                    to use the setter we have previously created. read the notes above on how
                    the setter/getter works if this makes no sense */
					multichoice[property](data[property])
				}
			}

			multichoice.manifestation.find('.multichoice-edit-option').each(function(i,v) {
				delete_option($(v));
			})

			/* the for loop only handles scalars, here we do the specifics */
			if (data['options']) {
				var has_answers = false;
				if (data['answers']) {
					var has_answers = true;
				}
				for (var i in data['options']) {
					var is_answer = false;
					if (has_answers) {
						var index = data['answers'].indexOf(data['options'][i].trim());
						if (index >= 0 && index !== false) {
							is_answer = true;
							/* don't add twice */
							data['answers'].splice(index,1);
						}
					}
					console.log('add choice', data['options'][i], is_answer)
					multichoice.add_choice(data['options'][i], is_answer);
					console.log(multichoice._data['options'])
				}
			}
			this._old_data = JSON.parse(JSON.stringify(my_data));
		}

		multichoice.loading = function() {
			multichoice.manifestation.find('.edit.question-section .form').addClass('loading');
		}

		multichoice.done_loading = function() {
			multichoice.manifestation.find('.edit.question-section .form').removeClass('loading');
			multichoice.manifestation.find('.edit.question-section .form').dimmer('hide');
		};

		multichoice.validate = function() {
			return multichoice.manifestation.find('.ui.form').form('validate form');
		};

		multichoice.init = function(){
			multichoice.manifestation.find('.ui.checkbox').checkbox();
			multichoice.manifestation.find('.ui.radio').checkbox();

			multichoice.manifestation.find('[data-content]').popup({
				position:'top center',
				variation:'inverted',
				transition:'drop',
				exclusive:'true',
				closeable:'true',
				delay:{
					show:500
				}
			});

			multichoice.manifestation.find('.ui.form').form({
				prompt:{
					identifier:'prompt',
					rules:[
						{type:'empty', prompt:'Please enter a question.'}
					]
				},
				points:{
					identifier:'points',
					rules:[
						{type:'empty', prompt:'Please enter a value.'},
						{type:'integer', prompt:'Please enter number.'}
					]
				},
				options:{
					identifier:'option',
					rules:[
						{type:'empty', prompt:'Please enter an option.'},
					]	
				}
			},{
				inline:true, 
				on:'blur',
				keyboardShortcuts: true
			});

		}

		var ajax_submit_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				multichoice.question_id(data.id);
				multichoice._old_data = JSON.parse(JSON.stringify(my_data));

				multichoice.manifestation.find('.edit.question-section .form').dimmer('show');

				setTimeout(function(){
					multichoice.done_loading();
					multichoice.summary();
				}, 1500);
			} else {
				console.log('server did not save the question!!!', data.message)
				showErrorMessage(data.message);
			}
		};
		var ajax_submit_failure = function() {
			/* this fires before always */
			console.log('failure to save question!')
			showErrorMessage('An error occurred while creating the question. Please try again.');
		};
		var ajax_submit_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we submit <- just got called');
		};

		var ajax_delete_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				console.log('successfully deleted!');
				multichoice.done_loading();
				multichoice.manifestation.remove();
			} else {
				console.log('the server did not delete our question!', data.message);
				showErrorMessage(data.message);
			}
		};
		var ajax_delete_failure = function() {
			/* this fires before always */
			console.log('failure to delete a question!', arguments);
			showErrorMessage('An error occurred while deleting the question. Please try again.');
		};
		var ajax_delete_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we delete <- just got called');
		};

		multichoice.submit = function(submit_custom_cb) {
			if(!multichoice.validate())
				return false;

			multichoice.loading();
			submit_question_data(multichoice._data, submit_custom_cb,
								 ajax_submit_complete,
								 ajax_submit_failure,
								 ajax_submit_always);
		};

		multichoice.delete = function(delete_custom_cb) {
			multichoice.loading();
			multichoice.manifestation.find('[data-content]').popup('hide all');


			if (multichoice._data['question_id']) {
				delete_question(multichoice.question_id(), delete_custom_cb,
								ajax_delete_complete,
								ajax_delete_failure,
								ajax_delete_always);
			} else {
				/* mock ajax success for the handler */
				ajax_delete_complete({success: true}, "success"); 
			}
		};

		multichoice.edit = function() {
			/* SUGGESTION: put transition ui code here */
			multichoice.manifestation.find('.question-section').hide();
			multichoice.manifestation.find('.edit.question-section').show();
		};

		multichoice.summary = function() {
			/* SUGGESTION: put transition ui code here */
			multichoice.manifestation.find('.question-section').hide();
			multichoice.manifestation.find('.summary.question-section').show();
		}

		/* just for us */
		multichoice.manifestation.find('[data-x="option-count"]').text(multichoice.option_count()).val(multichoice.option_count());
		multichoice.init();

		/* last thing we do in construction is show ourselves */
		multichoice.manifestation.find('.question-section').hide()
		multichoice.manifestation.show();
		/* default mode is edit */
		multichoice.edit();
	}
	/* ------------ end multichoice ------------- */

	/* ------------ begin multichoice ------------- */
	const MultiSelectQuestion = function() {
		const multiselect = this;
		multiselect.type = "multiselect";
		multiselect.manifestation = copy_template_and_create(multiselect.type);

		var my_data = multiselect._data = {
			'question_id' 	: '',
			'type' 			: 'multiselect',
			'prompt' 		: '',
			'points' 		: '',
			'number' 		: '',
			'options' 		: [],
			'answers' 		: []
		}

		/* selector : action so we can later do multiselect[action]() */
		const action_map = {
			'.questionSubmit' 		: 	'submit',
			'.questionDelete' 		: 	'delete',
			'.questionAddChoice'	: 	'add_choice',
			'.questionEdit' 		: 	'edit',
			'.questionSummary'		:	'summary',
			'.questionReset'		:	'reset',
		}

		this._old_data = JSON.parse(JSON.stringify(my_data));// hacky, but hey!

		function wire_for_selector(selector) {
			return function(e) {
				multiselect[action_map[selector]]();
				console.log(selector);
			}
		}

		for (var selector in action_map) {
			multiselect.manifestation.find(selector).on('click', wire_for_selector(selector));
		}

		const my_derived_sections = {
			'prompt' : ['prompt-substr']
		};

		/* prompt-substr is a projection, (read only) the others
        are pure data, meaning they are bound more generically */
		multiselect.prompt_substr = function() {
			if (arguments.length > 0) 
				console.log('argument ignored in .prompt_substr, which is read-only');

			const truncated_prompt = multiselect._data['prompt'].substr(0, max_prompt_length_without_ellipses);

			if (use_ellipses_on_truncated_prompt 
				&& truncated_prompt.length == max_prompt_length_without_ellipses) {

				return truncated_prompt + '...';
			}

			return truncated_prompt;
		}

		/* this function exposes all of the data for multiselect,
        -> for example question_id as a getter/setter <-
        setting it sets it internally and updates all of the places in the
        markup that are annotated data-x="question_id":
        some_multiselect_question.question_id(123)
        some_multiselect_question.question_id() <- 123 */
		var bind_property_to_multiselect_as_getter_setter = function(property) {
			multiselect[property] = function(value) {
				if (arguments.length > 0) {
					/* set */
					multiselect._data[property] = value;

					/* this block of code handles setting things like prompt-substr */
					if (my_derived_sections[property]) {
						for (var i in my_derived_sections[property]) {
							/* data-x attributes often have -'s in them, switch to _,
                              for example this lets us grab data-x="prompt-substr",
                              and populate it using our own getter, prompt_substr */
							var derived_property = my_derived_sections[property][i].replace(/-/gm, '_');
							multiselect.manifestation.find(
								'[data-x="'+my_derived_sections[property][i]+'"]'
							)
							.val(multiselect[derived_property]())
							.text(multiselect[derived_property]());
						}
					}
					var children = multiselect.manifestation.find('[data-x="'+property+'"]');
					children.val(value);
					children.text(value);
					return multiselect;
				} else {
					/* get */
					return multiselect._data[property]
				}
			}
		}

		/* expose all of the properties */
		for (var property_to_be_available in my_data) {
			if (is_type_of([], my_data[property_to_be_available])) continue;

			bind_property_to_multiselect_as_getter_setter(property_to_be_available);
			bind_property_to_on_change(property_to_be_available)
		}

		function bind_property_to_on_change(property) {
			var children = multiselect.manifestation.find('[data-x="'+property+'"]');
			children.on('change', function(e) {
				const val = $(this).val();
				multiselect[property](val);
			});
		}

		multiselect.options = function() {
			return multiselect._data['options'];
		}

		multiselect.answers = function() {
			return multiselect._data['answers'];
		}

		const get_multiselect_option_index_in_options = function(multiselect_option) {
			var index = -1;
			multiselect.manifestation.find('.multiselect-edit-option').each(function(i,v){
				console.log($(v).attr('data-member'), multiselect_option.attr('data-member'))
				if ($(v).attr('data-member') === multiselect_option.attr('data-member')) {
					index = i;
					console.log(index)
				}
			})
			return index;
		}

		const delete_option = function(multiselect_option) {
			var index = get_multiselect_option_index_in_options(multiselect_option);
			multiselect._data['options'].splice(index,1);
			console.log('index', 'array post slice', index, multiselect._data['options'])
			var answer_element = multiselect_option.find('[data-x="answer"]');
			if (answer_element.is(':checked')) {
				var answer_index = multiselect._data['answers'].indexOf(answer_element.val().trim());
				if (answer_index >= 0 && answer_index !== false) {
					multiselect._data['answers'].splice(answer_index,1);
				}
			}

			multiselect_option.remove();
			multiselect.manifestation.find('[data-x="option-count"]').text(multiselect.option_count());
			multiselect.manifestation.find('[data-x="option-count"]').val(multiselect.option_count());
		}

		const wireup_delete_for_option = function(multiselect_option) {
			/* wirup delete for this guy */
			multiselect_option.find('.delete-option').on('click', function() {
				delete_option(multiselect_option);
			})
		}

		multiselect.option_count = function() {
			return multiselect._data['options'].length;	
		}

		var identifier_counter = 0;
		multiselect.add_choice = function(text, is_answer) {

			identifier_counter++;
			if (!text) text = '';
			multiselect._data['options'].push(text);

			/*  update count */
			console.log('option count updated')
			multiselect.manifestation.find('[data-x="option-count"]').text(multiselect.option_count())
			multiselect.manifestation.find('[data-x="option-count"]').val(multiselect.option_count())

			new_edit_option = $('.multiselect-edit-option.template')
			.clone()
			.removeClass('template')
			.show()
			.attr('data-member', identifier_counter);
			console.log(new_edit_option)
			/* set text */
			new_edit_option.find('[data-x="option"]').val(text)

			if (is_answer && is_answer === true) {
				multiselect._data['answers'].push(text);
				new_edit_option.find('[data-x="answer"]').prop('checked', true)
			} else {
				new_edit_option.find('[data-x="answer"]').prop('checked', false)
			}

			/* add to dom */
			new_edit_option.appendTo(multiselect.manifestation.find('.options'));

			/* wirup delete */
			wireup_delete_for_option(new_edit_option);

			/* onchange */
			new_edit_option.find('[data-x="answer"]').on('change', function() {
				multiselect._data['answers'] = [];
				multiselect.manifestation.find('[data-x="answer"]').each(function(i,v) {
					if ($(v).is(':checked')) 
						multiselect._data['answers'].push(
							$(v).closest('.option-container').find('[data-x="option"]').val().trim())
						});
			});

			/* only for teachers in the edit page really, normal dom elements don't change much */
			new_edit_option.find('[data-x="option"]').on('change', function() {
				multiselect._data['options'] = [];
				multiselect.manifestation.find('[data-x="option"]').each(function(i,v) {
					multiselect._data['options'].push($(v).val().trim());
				})
			});

			multiselect.init();

		}

		multiselect.reset = function(data) {
			multiselect.populate(this._old_data);
		}

		multiselect.populate = function(data) {
			for (var property in multiselect._data) {
				if (is_type_of('', data[property]) || is_type_of(0, data[property])) {
					/* this passes the data at data['question_id'] to multiselect.question_id()
                    to use the setter we have previously created. read the notes above on how
                    the setter/getter works if this makes no sense */
					multiselect[property](data[property])
				}
			}

			multiselect.manifestation.find('.multiselect-edit-option').each(function(i,v) {
				delete_option($(v));
			})

			/* the for loop only handles scalars, here we do the specifics */
			if (data['options']) {
				var has_answers = false;
				if (data['answers']) {
					var has_answers = true;
				}
				for (var i in data['options']) {
					var is_answer = false;
					if (has_answers) {
						var index = data['answers'].indexOf(data['options'][i].trim());
						if (index >= 0 && index !== false) {
							is_answer = true;
							/* don't add twice */
							data['answers'].splice(index,1);
						}
					}
					console.log('add choice', data['options'][i], is_answer)
					multiselect.add_choice(data['options'][i], is_answer);
					console.log(multiselect._data['options'])
				}
			}
			this._old_data = JSON.parse(JSON.stringify(my_data));
		}

		multiselect.loading = function() {
			multiselect.manifestation.find('.edit.question-section .form').addClass('loading');
		}

		multiselect.done_loading = function() {
			multiselect.manifestation.find('.edit.question-section .form').removeClass('loading');
			multiselect.manifestation.find('.edit.question-section .form').dimmer('hide');
		};

		multiselect.validate = function() {
			return multiselect.manifestation.find('.ui.form').form('validate form');
		};

		multiselect.init = function(){
			multiselect.manifestation.find('.ui.checkbox').checkbox();
			multiselect.manifestation.find('.ui.radio').checkbox();

			multiselect.manifestation.find('[data-content]').popup({
				position:'top center',
				variation:'inverted',
				transition:'drop',
				exclusive:'true',
				closeable:'true',
				delay:{
					show:500
				}
			});

			multiselect.manifestation.find('.ui.form').form({
				prompt:{
					identifier:'prompt',
					rules:[
						{type:'empty', prompt:'Please enter a question.'}
					]
				},
				points:{
					identifier:'points',
					rules:[
						{type:'empty', prompt:'Please enter a value.'},
						{type:'integer', prompt:'Please enter number.'}
					]
				},
				options:{
					identifier:'option',
					rules:[
						{type:'empty', prompt:'Please enter an option.'},
					]	
				}
			},{
				inline:true, 
				on:'blur',
				keyboardShortcuts: true
			});

		}

		var ajax_submit_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				multiselect.question_id(data.id);
				multiselect._old_data = JSON.parse(JSON.stringify(my_data));

				multiselect.manifestation.find('.edit.question-section .form').dimmer('show');

				setTimeout(function(){
					multiselect.done_loading();
					multiselect.summary();
				}, 1500);
			} else {
				console.log('server did not save the question!!!', data.message)
				showErrorMessage(data.message);
			}
		};
		var ajax_submit_failure = function() {
			/* this fires before always */
			console.log('failure to save question!')
			showErrorMessage('An error occurred while creating the question. Please try again.');
		};
		var ajax_submit_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we submit <- just got called');
		};

		var ajax_delete_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				console.log('successfully deleted!');
				multiselect.done_loading();
				multiselect.manifestation.remove();
			} else {
				console.log('the server did not delete our question!', data.message);
				showErrorMessage(data.message);
			}
		};
		var ajax_delete_failure = function() {
			/* this fires before always */
			console.log('failure to delete a question!', arguments);
			showErrorMessage('An error occurred while deleting the question. Please try again.');
		};
		var ajax_delete_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we delete <- just got called');
		};

		multiselect.submit = function(submit_custom_cb) {
			if(!multiselect.validate())
				return false;

			multiselect.loading();
			submit_question_data(multiselect._data, submit_custom_cb,
								 ajax_submit_complete,
								 ajax_submit_failure,
								 ajax_submit_always);
		};

		multiselect.delete = function(delete_custom_cb) {
			multiselect.loading();
			multiselect.manifestation.find('[data-content]').popup('hide all');


			if (multiselect._data['question_id']) {
				delete_question(multiselect.question_id(), delete_custom_cb,
								ajax_delete_complete,
								ajax_delete_failure,
								ajax_delete_always);
			} else {
				/* mock ajax success for the handler */
				ajax_delete_complete({success: true}, "success"); 
			}
		};

		multiselect.edit = function() {
			/* SUGGESTION: put transition ui code here */
			multiselect.manifestation.find('.question-section').hide();
			multiselect.manifestation.find('.edit.question-section').show();
		};

		multiselect.summary = function() {
			/* SUGGESTION: put transition ui code here */
			multiselect.manifestation.find('.question-section').hide();
			multiselect.manifestation.find('.summary.question-section').show();
		}

		/* just for us */
		multiselect.manifestation.find('[data-x="option-count"]').text(multiselect.option_count()).val(multiselect.option_count());
		multiselect.init();

		/* last thing we do in construction is show ourselves */
		multiselect.manifestation.find('.question-section').hide()
		multiselect.manifestation.show();
		/* default mode is edit */
		multiselect.edit();
	}
	/* ------------ end multiselect ------------- */




	/* ------------ begin essay ------------- */
	const EssayQuestion = function() {
		const essay = this;
		essay.type = "essay";
		essay.manifestation = copy_template_and_create(essay.type);

		var my_data = essay._data = {
			'question_id' : '',
			'type' : 'essay',
			'prompt' : '',
			'points' : '',
			'number' : ''
		}

		const action_map = {
			'.questionSubmit' 		: 	'submit',
			'.questionDelete' 		: 	'delete',
			'.questionEdit' 		: 	'edit',
			'.questionSummary'		:	'summary',
			'.questionReset'		:	'reset',
		}

		this._old_data = JSON.parse(JSON.stringify(my_data));


		function wire_for_selector(selector) {
			return function(e) {
				essay[action_map[selector]]();
				console.log(selector);
			}
		}

		for (var selector in action_map) {
			essay.manifestation.find(selector).on('click', wire_for_selector(selector));
		}

		const my_derived_sections = {
			'prompt' : ['prompt-substr']
		};
		/* prompt-substr is a projection, the others
        are pure data, meaning they are bound more generically */
		essay.prompt_substr = function() {
			if (arguments.length > 0) 
				console.log('argument ignored in .prompt_substr, which is read-only');

			const truncated_prompt = essay._data['prompt'].substr(0, max_prompt_length_without_ellipses);

			if (use_ellipses_on_truncated_prompt 
				&& truncated_prompt.length == max_prompt_length_without_ellipses) {

				return truncated_prompt + '...';
			}

			return truncated_prompt;
		}

		/* this function exposes all of the data for essay,
        -> for example question_id as a getter/setter <-
        setting it sets it internally and updates all of the places in the
        markup that are annotated data-x="question_id":
        some_essay_question.question_id(123)
        some_essay_question.question_id() <- 123 */
		var bind_property_to_essay_as_getter_setter = function(property) {
			essay[property] = function(value) {
				if (arguments.length > 0) {
					/* set */
					essay._data[property] = value;

					/* this block of code handles setting things like prompt-substr */
					if (my_derived_sections[property]) {
						for (var i in my_derived_sections[property]) {
							/* data-x attributes often have -'s in them, switch to _,
                              for example this lets us grab data-x="prompt-substr",
                              and populate it using our own getter, prompt_substr */
							var derived_property = my_derived_sections[property][i].replace(/-/gm, '_');
							essay.manifestation.find(
								'[data-x="'+my_derived_sections[property][i]+'"]'
							)
							.val(essay[derived_property]())
							.text(essay[derived_property]());
						}
					}
					var children = essay.manifestation.find('[data-x="'+property+'"]');
					children.val(value);
					children.text(value);
					return essay;
				} else {
					/* get */
					return essay._data[property]
				}
			}
		}

		/* expose all of the properties */
		for (var property_to_be_available in my_data) {
			bind_property_to_essay_as_getter_setter(property_to_be_available);	
			bind_property_to_on_change(property_to_be_available)
		}

		function bind_property_to_on_change(property) {
			var children = essay.manifestation.find('[data-x="'+property+'"]');
			children.on('change', function(e) {
				const val = $(this).val();
				essay[property](val);
			});
		}

		essay.reset = function() {
			essay.populate(essay._old_data);
		}

		essay.populate = function(data) {
			for (var property in essay._data) {
				if (is_type_of('', data[property]) || is_type_of(0, data[property])) {
					/* this passes the data at data['question_id'] to essay.question_id()
                    to use the setter we have previously created. read the notes above on how
                    the setter/getter works if this makes no sense */
					essay[property](data[property])
				} else {
					console.log('incorrect value type encountered in population of essay:',property,data[property]);
				}
			}
			essay._old_data = JSON.parse(JSON.stringify(essay._data));
		}

		essay.loading = function() {
			essay.manifestation.find('.edit.question-section .form').addClass('loading');
		}

		essay.done_loading = function() {
			essay.manifestation.find('.edit.question-section .form').removeClass('loading');
			essay.manifestation.find('.edit.question-section .form').dimmer('hide');
		};

		essay.validate = function() {
			return essay.manifestation.find('.ui.form').form('validate form');
		};

		essay.init = function(){
			essay.manifestation.find('[data-content]').popup({
				position:'top center',
				variation:'inverted',
				transition:'drop',
				exclusive:'true',
				closeable:'true',
				delay:{
					show:500
				}
			});

			essay.manifestation.find('.ui.form').form({
				prompt:{
					identifier:'prompt',
					rules:[
						{type:'empty', prompt:'Please enter a question.'}
					]
				},
				points:{
					identifier:'points',
					rules:[
						{type:'empty', prompt:'Please enter a value.'},
						{type:'integer', prompt:'Please enter number.'}
					]
				}
			},{
				inline:true, 
				on:'blur',
				keyboardShortcuts: true
			});

		}

		var ajax_submit_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {

				essay.question_id(data.id);
				essay._old_data = JSON.parse(JSON.stringify(essay._data));
				essay.manifestation.find('.edit.question-section .form').dimmer('show');

				setTimeout(function(){
					essay.done_loading();
					essay.summary();
				}, 1500);


			} else {
				console.log('server did not save the question!!!', data.message)
				showErrorMessage(data.message);
			}
		};
		var ajax_submit_failure = function() {
			/* this fires before always */
			console.log('failure to save question!')
			showErrorMessage('An error occurred while creating the question. Please try again.');
		};
		var ajax_submit_always = function(data, success, jqxhr) {};

		var ajax_delete_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				essay.done_loading();
				essay.manifestation.remove();
			} else {
				console.log('the server did not delete our question!', data.message);
				showErrorMessage(data.message);
			}
		};
		var ajax_delete_failure = function() {
			/* this fires before always */
			console.log('failure to delete a question!', arguments);
			showErrorMessage('An error occurred while deleting the question. Please try again.');
		};
		var ajax_delete_always = function(data, success, jqxhr) {};

		essay.submit = function(submit_custom_cb) {
			if(!essay.validate())
				return false;

			essay.loading();
			submit_question_data(essay._data, submit_custom_cb,
								 ajax_submit_complete,
								 ajax_submit_failure,
								 ajax_submit_always);
		};

		essay.delete = function(delete_custom_cb) {
			essay.loading();
			essay.manifestation.find('[data-content]').popup('hide all');

			if (essay._data['question_id']) {
				delete_question(essay.question_id(), delete_custom_cb,
								ajax_delete_complete,
								ajax_delete_failure,
								ajax_delete_always);
			} else {
				/* mock ajax success for the handler */
				ajax_delete_complete({success: true}, "success"); 
			}
		};

		essay.edit = function() {
			essay.manifestation.find('.question-section').hide();
			essay.manifestation.find('.edit.question-section').show();
		};

		essay.summary = function() {
			essay.manifestation.find('.question-section').hide();
			essay.manifestation.find('.summary.question-section').show();
		}

		essay.init();
		essay.manifestation.show();
		essay.edit();
	}
	/*---------------- end essay -------------*/


	/* ------------ begin short answer ------------- */
	const ShortAnswerQuestion = function() {
		const shortanswer = this;
		shortanswer.type = "shortanswer";
		shortanswer.manifestation = copy_template_and_create(shortanswer.type);

		var my_data = shortanswer._data = {
			'question_id' : '',
			'type' : 'shortanswer',
			'prompt' : '',
			'points' : '',
			'number' : ''
		}

		const my_derived_sections = {
			'prompt' : ['prompt-substr']
		};

		const action_map = {
			'.questionSubmit' 		: 	'submit',
			'.questionDelete' 		: 	'delete',
			'.questionEdit' 		: 	'edit',
			'.questionSummary'		:	'summary',
			'.questionReset'		:	'reset',
		}

		shortanswer._old_data = JSON.parse(JSON.stringify(shortanswer._data));

		function wire_for_selector(selector) {
			return function(e) {
				shortanswer[action_map[selector]]();
				console.log(selector);
			}
		}

		for (var selector in action_map) {
			shortanswer.manifestation.find(selector).on('click', wire_for_selector(selector));
		}

		/* prompt-substr is a projection, the others
        are pure data, meaning they are bound more generically */
		shortanswer.prompt_substr = function() {
			if (arguments.length > 0) 
				console.log('argument ignored in .prompt_substr, which is read-only');

			const truncated_prompt = shortanswer._data['prompt'].substr(0, max_prompt_length_without_ellipses);

			if (use_ellipses_on_truncated_prompt 
				&& truncated_prompt.length == max_prompt_length_without_ellipses) {

				return truncated_prompt + '...';
			}

			return truncated_prompt;
		}

		/* this function exposes all of the data for shortanswer,
        -> for example question_id as a getter/setter <-
        setting it sets it internally and updates all of the places in the
        markup that are annotated data-x="question_id":
        some_shortanswer_question.question_id(123)
        some_shortanswer_question.question_id() <- 123 */
		var bind_property_to_shortanswer_as_getter_setter = function(property) {
			shortanswer[property] = function(value) {
				if (arguments.length > 0) {
					/* set */
					shortanswer._data[property] = value;

					/* this block of code handles setting things like prompt-substr */
					if (my_derived_sections[property]) {
						for (var i in my_derived_sections[property]) {
							/* data-x attributes often have -'s in them, switch to _,
                              for example this lets us grab data-x="prompt-substr",
                              and populate it using our own getter, prompt_substr */
							var derived_property = my_derived_sections[property][i].replace(/-/gm, '_');
							shortanswer.manifestation.find(
								'[data-x="'+my_derived_sections[property][i]+'"]'
							)
							.val(shortanswer[derived_property]())
							.text(shortanswer[derived_property]());
						}
					}
					var children = shortanswer.manifestation.find('[data-x="'+property+'"]');
					children.val(value);
					children.text(value);
					return shortanswer;
				} else {
					/* get */
					return shortanswer._data[property]
				}
			}
		}

		/* expose all of the properties */
		for (var property_to_be_available in my_data)  {
			bind_property_to_shortanswer_as_getter_setter(property_to_be_available);	
			bind_property_to_on_change(property_to_be_available)
		}

		function bind_property_to_on_change(property) {
			var children = shortanswer.manifestation.find('[data-x="'+property+'"]');
			children.on('change', function(e) {
				const val = $(this).val();
				shortanswer[property](val);
			});
		}

		shortanswer.reset = function() {
			shortanswer.populate(shortanswer._old_data);
		}

		shortanswer.populate = function(data) {
			for (var property in shortanswer._data) {
				if (is_type_of('', data[property]) || is_type_of(0, data[property])) {
					/* this passes the data at data['question_id'] to shortanswer.question_id()
                    to use the setter we have previously created. read the notes above on how
                    the setter/getter works if this makes no sense */
					shortanswer[property](data[property])
				} else {
					console.log('incorrect type encountered in population of shortanswer:',property,data[property]);
				}
			}
			shortanswer._old_data = JSON.parse(JSON.stringify(shortanswer._data));
		}

		shortanswer.loading = function() {
			shortanswer.manifestation.find('.edit.question-section .form').addClass('loading');
		}

		shortanswer.done_loading = function() {
			shortanswer.manifestation.find('.edit.question-section .form').removeClass('loading');
			shortanswer.manifestation.find('.edit.question-section .form').dimmer('hide');
		};

		shortanswer.validate = function() {
			return shortanswer.manifestation.find('.ui.form').form('validate form');
		};

		shortanswer.init = function(){
			shortanswer.manifestation.find('[data-content]').popup({
				position:'top center',
				variation:'inverted',
				transition:'drop',
				exclusive:'true',
				closeable:'true',
				delay:{
					show:500
				}
			});

			shortanswer.manifestation.find('.ui.form').form({
				prompt:{
					identifier:'prompt',
					rules:[
						{type:'empty', prompt:'Please enter a question.'}
					]
				},
				points:{
					identifier:'points',
					rules:[
						{type:'empty', prompt:'Please enter a value.'},
						{type:'integer', prompt:'Please enter number.'}
					]
				}
			},{
				inline:true, 
				on:'blur',
				keyboardShortcuts: true
			});

		}

		var ajax_submit_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {				
				shortanswer.question_id(data.id);
				shortanswer._old_data = JSON.parse(JSON.stringify(shortanswer._data));
				shortanswer.manifestation.find('.edit.question-section .form').dimmer('show');

				setTimeout(function(){
					shortanswer.done_loading();
					shortanswer.summary();
				}, 1500);


			} else {
				console.log('server did not save the question!!!', data.message)
				showErrorMessage(data.message);
			}
		};
		var ajax_submit_failure = function() {
			/* this fires before always */
			console.log('failure to save question!')
			showErrorMessage('An error occurred while creating the question. Please try again.');
		};
		var ajax_submit_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we submit <- just got called');
		};

		var ajax_delete_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				shortanswer.done_loading();
				shortanswer.manifestation.remove();
			} else {
				console.log('the server did not delete our question!', data.message);
				showErrorMessage(data.message);
			}
		};
		var ajax_delete_failure = function() {
			/* this fires before always */
			console.log('failure to delete a question!', arguments);
			showErrorMessage('An error occurred while deleting the question. Please try again.');
		};
		var ajax_delete_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we delete <- just got called');
		};

		shortanswer.submit = function(submit_custom_cb) {
			if(!shortanswer.validate())
				return false;

			shortanswer.loading();
			submit_question_data(shortanswer._data, submit_custom_cb,
								 ajax_submit_complete,
								 ajax_submit_failure,
								 ajax_submit_always);
		};

		shortanswer.delete = function(delete_custom_cb) {
			shortanswer.loading();
			shortanswer.manifestation.find('[data-content]').popup('hide all');

			if (shortanswer._data['question_id']) {
				delete_question(shortanswer.question_id(), delete_custom_cb,
								ajax_delete_complete,
								ajax_delete_failure,
								ajax_delete_always);
			} else {
				/* mock ajax success for the handler */
				ajax_delete_complete({success: true}, "success"); 
			}
		};

		shortanswer.edit = function() {
			shortanswer.manifestation.find('.question-section').hide();
			shortanswer.manifestation.find('.edit.question-section').show();
		};

		shortanswer.summary = function() {
			shortanswer.manifestation.find('.question-section').hide();
			shortanswer.manifestation.find('.summary.question-section').show();
		}

		shortanswer.init();
		shortanswer.manifestation.show();
		shortanswer.edit();
	}
	/*---------------- end short answer -------------*/ 
	const TFQuestion = function() {
		const truefalse = this;
		truefalse.type = "truefalse";
		truefalse.manifestation = copy_template_and_create(truefalse.type);

		var my_data = truefalse._data = {
			'question_id' : '',
			'type' : 'truefalse',
			'prompt' : '',
			'points' : '',
			'number' : '',
			'options' : ['true', 'false'],
			'answers' : ['false']
		}

		const my_derived_sections = {
			'prompt' : ['prompt-substr']
		};

		const action_map = {
			'.questionSubmit'       :   'submit',
			'.questionDelete'       :   'delete',
			'.questionEdit'         :   'edit',
			'.questionSummary'      :   'summary',
			'.questionSetTrue'      :   'check',
			'.questionSetFalse'     :   'uncheck',
			'.questionReset'		:	'reset',
		}

		truefalse._old_data = JSON.parse(JSON.stringify(truefalse._data));

		function wire_for_selector(selector) {
			return function(e) {
				truefalse[action_map[selector]]();
				console.log(selector);
			}
		}

		for (var selector in action_map) {
			truefalse.manifestation.find(selector).on('click', wire_for_selector(selector));
		}

		/* prompt-substr is a projection, the others
        are pure data, meaning they are bound more generically */
		truefalse.prompt_substr = function() {
			if (arguments.length > 0) 
				console.log('argument ignored in .prompt_substr, which is read-only');

			const truncated_prompt = truefalse._data['prompt'].substr(0, max_prompt_length_without_ellipses);

			if (use_ellipses_on_truncated_prompt 
				&& truncated_prompt.length == max_prompt_length_without_ellipses) {

				return truncated_prompt + '...';
			}

			return truncated_prompt;
		}

		/* this function exposes all of the data for truefalse,
        -> for example question_id as a getter/setter <-
        setting it sets it internally and updates all of the places in the
        markup that are annotated data-x="question_id":
        some_truefalse_question.question_id(123)
        some_truefalse_question.question_id() <- 123 */
		var bind_property_to_truefalse_as_getter_setter = function(property) {
			truefalse[property] = function(value) {
				if (arguments.length > 0) {
					/* set */
					truefalse._data[property] = value;

					/* this block of code handles setting things like prompt-substr */
					if (my_derived_sections[property]) {
						for (var i in my_derived_sections[property]) {
							/* data-x attributes often have -'s in them, switch to _,
                              for example this lets us grab data-x="prompt-substr",
                              and populate it using our own getter, prompt_substr */
							var derived_property = my_derived_sections[property][i].replace(/-/gm, '_');
							truefalse.manifestation.find(
								'[data-x="'+my_derived_sections[property][i]+'"]'
							)
							.val(truefalse[derived_property]())
							.text(truefalse[derived_property]());
						}
					}
					var children = truefalse.manifestation.find('[data-x="'+property+'"]');
					children.val(value);
					children.text(value);
					return truefalse;
				} else {
					/* get */
					return truefalse._data[property]
				}
			}
		}

		truefalse.manifestation.find('.checkable').on('change', function () {
			var $checked = truefalse.manifestation.find(':checked')
			if ($checked.length > 0) {
				truefalse._data['answers'] = [true];
			} else {
				truefalse._data['answers'] = [false];
			}
		});

		/* expose all of the properties */
		for (var property_to_be_available in my_data) {
			if (is_type_of([], my_data[property_to_be_available])) continue;
			bind_property_to_truefalse_as_getter_setter(property_to_be_available);  
			bind_property_to_on_change(property_to_be_available)
		}

		function bind_property_to_on_change(property) {
			var children = truefalse.manifestation.find('[data-x="'+property+'"]');
			children.on('change', function(e) {
				const val = $(this).val();
				console.log('changed to', val)
				truefalse[property](val);
			});
		}

		truefalse.reset = function() {
			truefalse.populate(truefalse._old_data)
		}

		truefalse.populate = function(data) {
			for (var property in truefalse._data) {
				if (is_type_of('', data[property]) || is_type_of(0, data[property])) {
					/* this passes the data at data['question_id'] to truefalse.question_id()
                    to use the setter we have previously created. read the notes above on how
                    the setter/getter works if this makes no sense */
					truefalse[property](data[property])
				} else {
					// console.log('incorrect type encountered in population of truefalse:',property,data[property]);
				}
			}
			console.log("TRUEFALSE", data)
			if (data['answers'].length > 0) {
				var answer_is_true = (data['answers'][0].trim().toLowerCase() == 'true')
				} else {
					answer_is_true = false;
				}
			truefalse.manifestation.find('.checkable').prop('checked', answer_is_true);
			truefalse._data['answers'] = [ ''+answer_is_true ];
			truefalse._old_data = JSON.parse(JSON.stringify(truefalse._data));
		};

		truefalse.manifestation.find('[data-x="answer"]').on('change', function() {
			if (truefalse.manifestation.find('[data-x="answer"]').is(':checked')) {
				truefalse._data['answers'] = ['true'];
			} else {
				truefalse._data['answers'] = ['false'];
			}
		});

		truefalse.loading = function() {
			truefalse.manifestation.find('.edit.question-section .form').addClass('loading');
		}

		truefalse.done_loading = function() {
			truefalse.manifestation.find('.edit.question-section .form').removeClass('loading');
			truefalse.manifestation.find('.edit.question-section .form').dimmer('hide');
		};

		truefalse.validate = function() {
			return truefalse.manifestation.find('.ui.form').form('validate form');
		};

		truefalse.init = function(){
			truefalse.manifestation.find('.ui.toggle.checkbox').checkbox();

			truefalse.manifestation.find('[data-content]').popup({
				position:'top center',
				variation:'inverted',
				transition:'drop',
				exclusive:'true',
				closeable:'true',
				delay:{
					show:500
				}
			});

			truefalse.manifestation.find('.ui.form').form({
				prompt:{
					identifier:'prompt',
					rules:[
						{type:'empty', prompt:'Please enter a question.'}
					]
				},
				points:{
					identifier:'points',
					rules:[
						{type:'empty', prompt:'Please enter a value.'},
						{type:'integer', prompt:'Please enter number.'}
					]
				}
			},{
				inline:true, 
				on:'blur',
				keyboardShortcuts: true
			});
		};

		truefalse.check = function(){
			truefalse.manifestation.find('.ui.toggle.checkbox').checkbox('check');		
		};

		truefalse.uncheck = function(){
			truefalse.manifestation.find('.ui.toggle.checkbox').checkbox('uncheck');		
		};


		var ajax_submit_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {

				truefalse.question_id(data.id);
				truefalse._old_data = JSON.parse(JSON.stringify(truefalse._data));
				truefalse.manifestation.find('.edit.question-section .form').dimmer('show');

				setTimeout(function(){
					truefalse.done_loading();
					truefalse.summary();
				}, 1500);


			} else {
				console.log('server did not save the question!!!', data.message)
				showErrorMessage(data.message);
			}
		};
		var ajax_submit_failure = function() {
			/* this fires before always */
			console.log('failure to save question!')
			showErrorMessage('An error occurred while creating the question. Please try again.');
		};
		var ajax_submit_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we submit <- just got called');
		};

		var ajax_delete_complete = function(data, success, jqxhr) {
			/* this fires before always */
			if (success === "success" && data.success === true) {
				console.log('successfully deleted!');
				truefalse.done_loading();
				truefalse.manifestation.remove();
			} else {
				console.log('the server did not delete our question!', data.message);
				showErrorMessage(data.message);
			}
		};
		var ajax_delete_failure = function() {
			/* this fires before always */
			console.log('failure to delete a question!', arguments);
			showErrorMessage('An error occurred while deleting the question. Please try again.');
		};
		var ajax_delete_always = function(data, success, jqxhr) {
			/* but this always fires =() */
			console.log('handler to be called no matter what when we delete <- just got called');
		};

		truefalse.submit = function(submit_custom_cb) {
			if(!truefalse.validate())
				return false;

			truefalse.loading();
			submit_question_data(truefalse._data, submit_custom_cb,
								 ajax_submit_complete,
								 ajax_submit_failure,
								 ajax_submit_always);
		};

		truefalse.delete = function(delete_custom_cb) {
			truefalse.loading();
			truefalse.manifestation.find('[data-content]').popup('hide all');

			if (truefalse._data['question_id']) {
				delete_question(truefalse.question_id(), delete_custom_cb,
								ajax_delete_complete,
								ajax_delete_failure,
								ajax_delete_always);
			} else {
				/* mock ajax success for the handler */
				ajax_delete_complete({success: true}, "success"); 
			}
		};

		truefalse.edit = function() {
			truefalse.manifestation.find('.question-section').hide();
			truefalse.manifestation.find('.edit.question-section').show();
		};

		truefalse.summary = function() {
			truefalse.manifestation.find('.question-section').hide();
			truefalse.manifestation.find('.summary.question-section').show();
		}

		truefalse.init();
		truefalse.manifestation.show();
		truefalse.edit();
	}

	function is_type_of(example, thing_to_be_tested) {
		return typeof(example) === typeof(thing_to_be_tested);
	}

	function copy_template_and_create(type) {
		return $(static_properties_of_questions[type].template_selector)
		.clone()
		.removeClass('template')
		.appendTo(question_list_selector);
	}

	function get_type_class(type) {
		switch(type){
			case "multichoice" : return MultiChoiceQuestion
			case "shortanswer" : return ShortAnswerQuestion
			case "essay" : return EssayQuestion
			case "truefalse" : return TFQuestion
			default : throw("Unsupported question type!!!")
		}
	}
	function get_csrf_token() { return $.cookie('csrftoken'); }

	function submit_question_data(data, custom_completed, complete_callback, failure_callback, always_callback) {
		$.ajax({
			type : "POST",
			url : api_endpoint_for_questions,
			data :  {
				'question' : JSON.stringify(data),
				'exam_id' : exam_id
			},
			headers: {
				'X-CSRFToken' : get_csrf_token()
			}
		})
		.done(function(a, b, c, d) {
			complete_callback(a,b,c,d);
			!custom_completed || custom_completed(a,b,c,d); })
		.fail(failure_callback)
		.always(always_callback)
	}

	function delete_question(question_id, custom_completed, complete_callback, failure_callback, always_callback) {
		if (!(is_type_of('',question_id) || is_type_of(0, question_id))){
			console.log('INVALID USAGE OF DELETE QUESTION: PASS AN ID, NOT AN OBJECT')
			return false;
		}
		$.ajax({
			type : "POST",
			url : api_endpoint_for_questions,
			data :  {
				'question_id' : question_id
			}, 
			headers :{
				'X-METHODOVERRIDE' : 'DELETE',
				'X-CSRFToken' : get_csrf_token()
			}
		})
		.done(function(a,b,c,d) {
			complete_callback(a,b,c,d);
			!custom_completed || custom_completed(a,b,c,d); })
		.fail(failure_callback)
		.always(always_callback)    
	}

	function add_question(type) {
		var question = null;
		switch(type){
			case "multichoice":
				question = new MultiChoiceQuestion();
				break;
			case "multiselect":
				question = new MultiSelectQuestion();
				break;
			case "shortanswer":
				question = new ShortAnswerQuestion();
				break;
			case "essay": 
				question = new EssayQuestion();
				break;
			case "truefalse":
				question = new TFQuestion();
				break;
		}
		return question;
	}

	$('.ui.button#addNewQuestion').on('click', function(){
		var type = $('.ui.button#addNewQuestionType').dropdown('get value');		
		add_question(type);
	});

	$('.ui.button#addNewQuestionType').dropdown('set selected', 'multichoice');

	for (var i in questions_present_at_pageload) {
		var question_data = questions_present_at_pageload[i];
		var question = null;
		switch(question_data.type){
			case "multichoice":
				question = new MultiChoiceQuestion();
				break;
			case "multiselect":
				question = new MultiSelectQuestion();
				break;
			case "shortanswer":
				question = new ShortAnswerQuestion();
				break;
			case "essay": 
				question = new EssayQuestion();
				break;
			case "truefalse":
				question = new TFQuestion();
				break;
		}
		if (question === null) continue;
		question.populate(question_data);
		question.summary();
	}

	$('.previewQuestions').on('click', function () {
		console.log('preview')
		$('.question-list, .adder').children().hide();
		$('.preview-list').show().load('/dashboard/rendered-exam/' + exam_id);
		$('.editQuestions').removeClass('active');
		$('.previewQuestions').addClass('active');
	})
	$('.editQuestions').on('click', function () {
		console.log('edit')
		$('.preview-list').hide();
		$('.question-list, .adder').children().show();
		$('.previewQuestions').removeClass('active');
		$('.editQuestions').addClass('active');
	})

});
