#!/usr/bin/env python3
"""Portable Research Tree structural contract, including project and log fields.

Errors name the failing field. Validation does not normalize, delete or rewrite
input. Historical decision-log references may outlive their graph nodes.
"""
from datetime import datetime
import math
import re

NODE_TYPES = {'evidence', 'idea', 'hypothesis', 'assumption', 'judgement', 'decision', 'openQuestion', 'rejectedBranch'}
NODE_STATUSES = {'confirmed', 'tentative', 'needsVerification', 'rejected', 'supersededReopened'}
RELATIONSHIPS = {'supports', 'contradicts', 'modifies', 'replaces', 'dependsOn'}
LOGIC_TYPES = {'any', 'all', 'exactlyOne', 'none', 'not', 'atLeastK'}
LOG_ACTIONS = {'created', 'updated', 'statusChanged', 'impact', 'relationship', 'logicSpot', 'replaced', 'logicSpotCreated', 'impactRecorded'}


def validate_document(data):
    errors = []

    def error(path, message):
        errors.append(f'{path}: {message}')

    def text(value, path, nonempty=False):
        if not isinstance(value, str) or (nonempty and not value.strip()):
            error(path, 'expected non-empty string' if nonempty else 'expected string')
            return False
        return True

    def localized(value, path):
        if not isinstance(value, dict):
            error(path, 'expected bilingual object with en and zh strings')
            return
        for lang in ('en', 'zh'):
            text(value.get(lang), f'{path}.{lang}')

    def stamp(value, path):
        if not isinstance(value, str):
            error(path, 'expected ISO timestamp with timezone')
            return
        try:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if parsed.tzinfo is None:
                raise ValueError('timezone required')
        except ValueError:
            error(path, 'expected ISO timestamp with timezone')

    def number(value, path, positive=False):
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or (positive and value <= 0):
            error(path, 'expected finite positive number' if positive else 'expected finite number')

    def ordered(value, path):
        if list(value)[:1] != ['languageType'] or value.get('languageType') != 'en-zh':
            error(path + '.languageType', 'must be first field with value en-zh')
        if list(value)[-1:] != ['end'] or value.get('end') != 'end':
            error(path + '.end', 'must be last field with value end')

    def unique_id(value, path, seen):
        if not text(value, path, True):
            return False
        if value in seen:
            error(path, f'duplicate ID {value!r}')
            return False
        seen.add(value)
        return True

    if not isinstance(data, dict):
        return ['root: expected object']
    if data.get('fileType') != 'research-tree':
        error('fileType', 'expected research-tree')
    if type(data.get('formatVersion')) is not int or data['formatVersion'] != 1:
        error('formatVersion', 'expected integer 1')
    if list(data)[-1:] != ['end'] or data.get('end') != 'end':
        error('end', 'must be last field with value end')
    text(data.get('documentId'), 'documentId', True)
    stamp(data.get('savedAt'), 'savedAt')
    view = data.get('viewState')
    if not isinstance(view, dict):
        error('viewState', 'expected object')
    else:
        if view.get('language') not in ('en', 'zh'):
            error('viewState.language', 'expected en or zh')
        if view.get('activePanel') not in ('graph', 'log'):
            error('viewState.activePanel', 'expected graph or log')
        viewport = view.get('viewport')
        if not isinstance(viewport, dict):
            error('viewState.viewport', 'expected object')
        else:
            for key in ('x', 'y', 'zoom'):
                number(viewport.get(key), f'viewState.viewport.{key}', key == 'zoom')
    tree = data.get('tree')
    if not isinstance(tree, dict):
        return errors + ['tree: expected object']
    if type(tree.get('schemaVersion')) is not int or tree['schemaVersion'] != 2:
        error('tree.schemaVersion', 'expected integer 2')
    project = tree.get('project')
    if not isinstance(project, dict):
        error('tree.project', 'expected object')
    else:
        text(project.get('id'), 'tree.project.id', True)
        localized(project.get('title'), 'tree.project.title')
        localized(project.get('researchQuestion'), 'tree.project.researchQuestion')
    collections = {}
    for name in ('nodes', 'edges', 'logicSpots', 'decisionLog', 'collapsedNodeIds'):
        value = tree.get(name)
        if not isinstance(value, list):
            error(f'tree.{name}', 'expected array')
            value = []
        collections[name] = value
    node_ids, spot_ids, edge_ids, log_ids = set(), set(), set(), set()
    for index, node in enumerate(collections['nodes']):
        path = f'tree.nodes[{index}]'
        if not isinstance(node, dict):
            error(path, 'expected object')
            continue
        ordered(node, path)
        unique_id(node.get('id'), path + '.id', node_ids)
        if node.get('type') not in tuple(NODE_TYPES):
            error(path + '.type', 'unknown node type')
        if node.get('status') not in tuple(NODE_STATUSES):
            error(path + '.status', 'unknown node status')
        stamp(node.get('createdAt'), path + '.createdAt')
        stamp(node.get('updatedAt'), path + '.updatedAt')
        content = node.get('content')
        if not isinstance(content, dict) or set(content) != {'en', 'zh'}:
            error(path + '.content', 'expected exactly en and zh objects')
            continue
        for lang in ('en', 'zh'):
            item = content[lang]
            here = path + '.content.' + lang
            if not isinstance(item, dict):
                error(here, 'expected object')
                continue
            for key in ('title', 'summary', 'notes', 'source'):
                text(item.get(key), here + '.' + key, key == 'title')
            assumptions = item.get('assumptions')
            if not isinstance(assumptions, list):
                error(here + '.assumptions', 'expected array of strings')
            else:
                for i, assumption in enumerate(assumptions):
                    text(assumption, f'{here}.assumptions[{i}]')
    for index, edge in enumerate(collections['edges']):
        path = f'tree.edges[{index}]'
        if not isinstance(edge, dict):
            error(path, 'expected object')
            continue
        unique_id(edge.get('id'), path + '.id', edge_ids)
        for key in ('sourceNodeId', 'targetNodeId'):
            value = edge.get(key)
            if not isinstance(value, str) or value not in node_ids:
                error(path + '.' + key, f'references missing node {value!r}')
        if edge.get('relationshipType') not in tuple(RELATIONSHIPS):
            error(path + '.relationshipType', 'unknown relationship')
        localized(edge.get('note'), path + '.note')
        stamp(edge.get('createdAt'), path + '.createdAt')
    parent_ids = set()
    logic_dependencies = {}
    for index, spot in enumerate(collections['logicSpots']):
        path = f'tree.logicSpots[{index}]'
        if not isinstance(spot, dict):
            error(path, 'expected object')
            continue
        ordered(spot, path)
        if unique_id(spot.get('id'), path + '.id', spot_ids) and spot['id'] in node_ids:
            error(path + '.id', 'collides with node ID')
        localized(spot.get('label'), path + '.label')
        for key in ('createdAt', 'updatedAt'):
            stamp(spot.get(key), path + '.' + key)
        parent = spot.get('parentNodeId')
        if not isinstance(parent, str) or parent not in node_ids:
            error(path + '.parentNodeId', f'references missing node {parent!r}')
        elif parent in parent_ids:
            error(path + '.parentNodeId', 'parent already has a logic spot')
        else:
            parent_ids.add(parent)
        inputs = spot.get('inputNodeIds')
        if not isinstance(inputs, list) or not inputs:
            error(path + '.inputNodeIds', 'expected non-empty array')
            inputs = []
        seen_inputs = set()
        for i, value in enumerate(inputs):
            if not isinstance(value, str) or value not in node_ids:
                error(f'{path}.inputNodeIds[{i}]', f'references missing node {value!r}')
            elif value in seen_inputs:
                error(f'{path}.inputNodeIds[{i}]', 'duplicate input')
            else:
                seen_inputs.add(value)
            if value == parent:
                error(f'{path}.inputNodeIds[{i}]', 'parent cannot be its own input')
        if isinstance(parent, str) and parent in node_ids and parent not in logic_dependencies:
            logic_dependencies[parent] = (index, inputs)
        rule = spot.get('logicType')
        if rule not in tuple(LOGIC_TYPES):
            error(path + '.logicType', 'unknown logic rule')
        if rule == 'not' and len(inputs) != 1:
            error(path + '.inputNodeIds', 'NOT requires exactly one input')
        threshold = spot.get('threshold')
        if rule == 'atLeastK':
            if type(threshold) is not int or not 1 <= threshold <= len(inputs):
                error(path + '.threshold', 'expected integer from 1 through input count')
        elif threshold is not None:
            error(path + '.threshold', 'must be null except for atLeastK')
    # Iterative traversal reports a concrete input path and does not recurse on
    # large valid trees. Edges here are formal dependencies, not semantic links.
    visited = set()
    cycle_found = False
    for start in logic_dependencies:
        if start in visited:
            continue
        active = {start}
        stack = [(start, iter(enumerate(logic_dependencies[start][1])))]
        while stack:
            parent, pending = stack[-1]
            try:
                input_index, child = next(pending)
            except StopIteration:
                active.remove(parent)
                visited.add(parent)
                stack.pop()
                continue
            if not isinstance(child, str) or child not in logic_dependencies:
                continue
            if child in active:
                index = logic_dependencies[parent][0]
                cycle = ' -> '.join([item[0] for item in stack] + [child])
                error(f'tree.logicSpots[{index}].inputNodeIds[{input_index}]', 'cyclic logic dependency: ' + cycle)
                cycle_found = True
                break
            if child not in visited:
                active.add(child)
                stack.append((child, iter(enumerate(logic_dependencies[child][1]))))
        if cycle_found:
            break
    block_ids = set()
    if 'canvas' in tree:
        canvas = tree['canvas']
        if not isinstance(canvas, dict):
            error('tree.canvas', 'expected object')
        else:
            blocks = canvas.get('backgroundBlocks')
            if not isinstance(blocks, list):
                error('tree.canvas.backgroundBlocks', 'expected array')
                blocks = []
            for index, block in enumerate(blocks):
                path = f'tree.canvas.backgroundBlocks[{index}]'
                if not isinstance(block, dict):
                    error(path, 'expected object')
                    continue
                if unique_id(block.get('id'), path + '.id', block_ids):
                    if block['id'] in node_ids or block['id'] in spot_ids:
                        error(path + '.id', 'collides with node or logic spot ID')
                localized(block.get('title'), path + '.title')
                color = block.get('color')
                if not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
                    error(path + '.color', 'expected #RRGGBB')
                for key in ('width', 'height'):
                    value = block.get(key)
                    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 160:
                        error(path + '.' + key, 'expected finite size >= 160')
                if type(block.get('locked')) is not bool:
                    error(path + '.locked', 'expected boolean')
            layers = canvas.get('layerOrder')
            if not isinstance(layers, list):
                error('tree.canvas.layerOrder', 'expected array')
            else:
                object_ids = node_ids | spot_ids | block_ids
                layer_ids = set()
                for index, value in enumerate(layers):
                    path = f'tree.canvas.layerOrder[{index}]'
                    if not isinstance(value, str) or value not in object_ids:
                        error(path, f'references missing canvas object {value!r}')
                    elif value in layer_ids:
                        error(path, 'duplicate ID in layer order')
                    else:
                        layer_ids.add(value)
    positions = tree.get('positions')
    if not isinstance(positions, dict):
        error('tree.positions', 'expected object')
    else:
        for key in sorted(node_ids | spot_ids | block_ids):
            if key not in positions:
                error('tree.positions.' + key, 'missing position')
        for key, position in positions.items():
            here = 'tree.positions.' + key
            if not isinstance(position, dict):
                error(here, 'expected object')
            else:
                number(position.get('x'), here + '.x')
                number(position.get('y'), here + '.y')
    collapsed = set()
    for index, value in enumerate(collections['collapsedNodeIds']):
        path = f'tree.collapsedNodeIds[{index}]'
        if not isinstance(value, str) or value not in node_ids:
            error(path, f'references missing node {value!r}')
        elif value in collapsed:
            error(path, 'duplicate collapsed node')
        else:
            collapsed.add(value)
    for index, entry in enumerate(collections['decisionLog']):
        path = f'tree.decisionLog[{index}]'
        if not isinstance(entry, dict):
            error(path, 'expected object')
            continue
        unique_id(entry.get('id'), path + '.id', log_ids)
        text(entry.get('nodeId'), path + '.nodeId', True)
        if 'nodeIds' in entry:
            references = entry['nodeIds']
            if not isinstance(references, list):
                error(path + '.nodeIds', 'expected array of historical node IDs')
            else:
                for i, value in enumerate(references):
                    text(value, f'{path}.nodeIds[{i}]', True)
        if entry.get('action') not in tuple(LOG_ACTIONS):
            error(path + '.action', f'unsupported action {entry.get("action")!r}; extend the contract instead of dropping history')
        localized(entry.get('summary'), path + '.summary')
        stamp(entry.get('timestamp'), path + '.timestamp')
    return errors
